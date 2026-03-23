# AGENTS.md

## Project Overview

Win Plan Tracker is an Angular 18 single-page application backed by Firebase. It helps teams manage team calendars, vacations, holidays, presence, dashboard metrics, team capacity, and Jira-backed sprint planning.

The repository has two runtime surfaces:

- `src/`: Angular frontend deployed to Firebase Hosting
- `functions/`: Firebase Cloud Functions used for Jira integration and other privileged backend actions

Supporting platform config also lives at the repo root, especially `firestore.rules`, `database.rules.json`, `firebase.json`, and environment files under `functions/`.

This file defines the working contract for agents operating in this repository. Follow existing codebase patterns first. Prefer safe, incremental changes over broad rewrites.

---

## Stack

### Frontend

- Angular 18
- Standalone components
- Angular Material
- SCSS
- RxJS
- Angular signals
- `date-fns`
- `echarts` via `ngx-echarts`

### Backend / Platform

- Firebase Hosting
- Firestore
- Firebase Auth
- Realtime Database
- Firebase Cloud Functions
- Node.js 20
- CommonJS in `functions/`

---

## Primary Engineering Goals

When working in this repository, optimize for the following:

1. Correctness of planning, calendar, dashboard, and Jira-related behavior
2. Preservation of auth, team-membership, and Firestore access assumptions
3. Backward compatibility of service contracts and callable response shapes
4. Small, localized, low-risk changes
5. Consistency with the surrounding feature and existing architecture
6. Maintainability and clarity over clever abstractions
7. UI polish only after correctness and consistency are preserved

---

## Decision Priorities

When instructions or tradeoffs conflict, prefer this order:

1. Preserve correctness and security
2. Respect Firestore rules assumptions and authenticated boundaries
3. Keep existing data contracts stable unless the task explicitly requires change
4. Follow the nearest existing implementation pattern
5. Prefer incremental changes over refactors
6. Reuse existing helpers, services, and UI primitives
7. Improve aesthetics only after functional behavior is correct

---

## High-Level Architecture

### Frontend layout

- `src/app/core/`: application services, guards, domain models, and cross-cutting concerns
- `src/app/features/`: route-level feature areas such as dashboard, calendar, teams, auth, settings, Jira, and sprint planning
- `src/app/shared/`: reusable UI components, helpers, and lightweight utilities
- `src/app/app.routes.ts`: top-level routing
- `src/app/app.config.ts`: bootstrap providers
- `src/app/firebase.ts`: Firebase client initialization; currently it only connects the Functions emulator in local development

### Frontend data flow

- Auth, Firestore, Realtime Database presence, and callable Functions are usually accessed through Angular services
- Most app-facing data access belongs in `src/app/core/services/`
- Services expose:
  - `Observable<T>` for real-time Firestore streams
  - `Promise<T>` for one-off reads, writes, and callable invocations
- Components should keep transient UI state local, usually with signals
- Shared Firestore real-time query wrapping lives in `src/app/shared/utils/firestore.util.ts`

### Backend layout

- `functions/index.js`: Cloud Functions entrypoint
- `functions/jira/`: Jira callable functions
- `functions/shared/`: shared helpers, auth guards, and config utilities

### Architecture boundary

- Frontend owns most application logic and orchestration
- Cloud Functions should stay thin and exist for privileged or protected operations
- Jira credentials and Jira API access must remain server-side
- Do not push privileged logic into the browser

---

## Core Domain Constraints

These constraints are critical and should be treated as repository invariants unless a task explicitly changes them.

### Routing and access

- Public routes: `/login`, `/register`, both guarded by `guestGuard`
- Authenticated app routes are wrapped by `ShellComponent` and `authGuard`
- Team administration routes currently use `roleGuard(['admin'])`
- `/sprints` renders `JiraComponent`; `/sprints/planning` renders `SprintPlanningComponent`
- Route guards live in `src/app/core/guards/auth.guard.ts`

### Firestore collections in active use

- `users`
- `teams`
- `teams/{teamId}/members`
- `events`
- `holidays`
- `notifications`
- `jiraCredentials`
- `planningSessions`

### Important persistence assumptions

- Team membership and manager/admin role drive many access checks, but some current rules are broader than product intent
- `events` are keyed as `${userId}_${date}`
- Team member enrichment docs live in `teams/{teamId}/members/{memberId}`
- `jiraCredentials` are stored per user at `jiraCredentials/{uid}`
- `planningSessions` are stored in Firestore; new docs are team-scoped in rules, and legacy docs without `teamId` currently fall back to creator-only access
- Presence is stored in Realtime Database under `presence/{uid}`
- Jira callable functions require authenticated callers
- Team membership mutations are now server-authoritative through the `updateTeamMembership` callable; do not reintroduce direct browser writes to another user's `users/{uid}.teamId`

### Firestore rules

- Read `firestore.rules` before changing persistence behavior
- Treat the checked-in rules as the source of truth, even when UI copy or docs imply something stricter
- Current rules intentionally allow all signed-in users to read `users`; do not treat that as an open security mismatch without a new product decision
- Current rules still allow all signed-in users to create `notifications`
- Current rules restrict `teams` reads to team members, no-team discovery users, and elevated roles
- Current rules scope `planningSessions` to same-team access, with creator-only fallback for legacy docs without `teamId`
- Never assume a client-side flow is valid unless rules support it
- UI changes that silently rely on looser access than rules allow are incorrect

---

## Jira Integration Rules

Jira is currently exposed through Firebase callable functions exported from `functions/index.js`:

- `checkJiraConfig`
- `getJiraTasks`
- `getJiraSprints`

There is also a `functions/jira/getBacklog.js` helper on disk, but it is not exported from `functions/index.js` at the moment.

Expected local runtime environment variables:

- `JIRA_DOMAIN`
- `JIRA_EMAIL`
- `JIRA_TOKEN`

The current repo wiring reads `.env` directly:

- `package.json` `start:emulators` sources `functions/.env`
- `functions/index.js` calls `dotenv.config()`

Do not assume `functions/.env.local` is loaded unless you verify the local tooling path you are using.

### Jira safety rules

- Never hardcode Jira credentials in frontend code
- Never move Jira credentials into browser-readable configuration
- Validate both Angular caller expectations and callable response shapes when changing Jira flows
- Keep callable handlers thin and shared Jira logic centralized when reused

---

## Frontend Conventions

### Angular conventions

- Prefer standalone components and lazy `loadComponent` routes
- Prefer `inject()` over constructor injection in new code
- Use signals for local, transient UI state
- Use RxJS streams for Firestore subscriptions and cross-service async composition
- Keep business logic out of templates
- Follow the surrounding file’s existing reactive style when mixing signals and observables
- Do not force a signals-only rewrite in observable-first code without strong reason
- Never wrap `@Input()` values in `computed()` — Angular's computed cache does not react to plain object input changes; use plain TypeScript getters instead
- Use `signal()` only for locally mutable state, never for values derived purely from `@Input()` properties

### Feature structure

- Match the current feature folder structure
- Colocate `.ts`, `.html`, and `.scss`
- Use one component per folder with `*.component.ts` naming
- Keep route/page components focused on orchestration
- Move reusable logic into services or `shared/`

### Service conventions

- Put app-facing data access in `src/app/core/services/`
- Return typed results
- Normalize Firestore data in services where needed
- Reuse `snapObservable(...)` for Firestore live queries instead of creating new snapshot wrappers
- Do not leak raw backend or Firestore document shapes deep into components unless that pattern already exists locally
- For team member-management candidate pickers, use `TeamDirectoryService.getMembershipCandidates(...)` instead of broad `users` collection reads
- Broad authenticated profile reads in `users` remain intentional for directory-style flows, but they do not justify reintroducing broad browser member pickers

### State and async handling

- Prefer the smallest state scope that solves the problem
- Keep local UI state local
- Do not introduce new global state patterns for feature-local problems
- Avoid unnecessary manual subscriptions when a cleaner existing pattern is already in use

---

## Styling and UI Conventions

### Styling rules

- Use SCSS
- Reuse theme tokens defined in `src/styles.scss`
- Respect light/dark theme behavior driven by `data-theme` on `<html>`
- Preserve the current visual direction: polished dashboard UI, strong gradients, rounded cards, and custom dialog treatments
- Prefer component-scoped styles over ad hoc global overrides
- Avoid introducing a second styling system

### UI implementation expectations

For any UI change, consider and preserve:

- loading states
- empty states
- error states
- disabled states
- permission-restricted states
- dark theme behavior
- dialog styling consistency
- responsive behavior for cards, tables, and planning layouts

### Design consistency rules

- Reuse existing dashboard, card, dialog, and form patterns before inventing new ones
- Prefer existing spacing, radius, elevation, and gradient language
- Avoid one-off styles unless the task truly requires a unique presentation
- Keep feature UI visually aligned with the rest of the product

---

## Backend Conventions

- Functions code is CommonJS, not TypeScript
- Keep callable handlers thin
- Move reusable backend logic into `functions/shared/`
- Throw `functions.https.HttpsError` for client-visible failures
- Require auth with `ensureAuthenticated(...)` for protected callables
- Preserve callable response compatibility where possible

Do not perform opportunistic backend rewrites during unrelated frontend work.

---

## Sprint Planning Product Direction

**Authoritative requirements: `docs/sprint-planning-jira-readonly-requirements.md`**

Read that file before any sprint planning or Jira integration work. The key rules it defines:

- Jira is read-only — WinPlan must never write to Jira
- Story points use a **dual-value model**: Jira story points (official, from Jira) vs planned story points (agreed during session, stored in WinPlan only)
- Planning snapshots are immutable — never rewrite historical records when Jira changes later
- After finalization, a post-planning review screen must surface issues needing manual Jira update (no Jira story points, or planned SP ≠ Jira SP)
- Planning history is WinPlan's memory — Jira alone cannot provide it

These product assumptions should guide changes in the sprint planning area unless the task explicitly changes them.

- The `/sprints` workspace currently shows an active sprint summary, a next-sprint issue inbox, and planning history loaded from `planningSessions`
- Planning targets the first future sprint returned by Jira, not the active sprint
- New planning starts from a participant-selection modal; resume and read-only review flows bypass that modal
- The primary planning action currently supports start, resume draft, or view completed plan depending on saved state
- Each task or story in planning should show at minimum:
  - title
  - assignee
  - Jira story points (from Jira)
  - planned story points (from WinPlan session)
- The planning experience should remain a structured guided workflow rather than a loose external collaboration process
- The current workflow is `review -> estimate -> plan -> review-sprint` with backlog, candidate, and planned buckets
- Saved sessions already include `participants`, `turnOrder`, and `turnOrderIndex`, but strict turn-based facilitation and active-turn notifications are not fully implemented today
- Preferred visual direction is premium dark enterprise SaaS UI with a clean, structured planning experience

When editing sprint planning, preserve this direction unless explicitly instructed otherwise.

---

## Known Project Patterns

- The app uses a mix of signals and observables; follow the local surrounding pattern
- Firebase client code mixes direct SDK imports (`@firebase/*`, `firebase/database`) with AngularFire for Functions (`@angular/fire/functions`)
- Only the Functions emulator is explicitly connected in `src/app/firebase.ts`
- Theme state is managed by `ThemeService`
- Auth state is centralized in `AuthService`
- Many dashboard and sprint calculations are date-driven and use `date-fns`
- Realtime Database is used for presence tracking
- Jira access is intentionally proxied through callable functions

Do not replace these patterns casually.

---

## Execution Rules

Before making changes:

- Read `docs/domain-model.md` before any implementation work — it is the authoritative reference for domain vocabulary, data shapes, and model relationships
- Read `docs/sprint-planning-jira-readonly-requirements.md` before any sprint planning or Jira integration work — it is the authoritative reference for product behavior, ownership boundaries, the dual story-point model, planning snapshot requirements, and the post-planning Jira review flow
- Inspect nearby files and follow the local pattern used in that feature area
- Prefer modifying existing code over introducing parallel abstractions
- Reuse existing services, helpers, and shared UI primitives before creating new ones
- Check whether the task touches auth, Firestore rules, Jira contracts, or shared styling before coding
- For larger tasks, create a short plan before implementation

While making changes:

- Keep diffs as small as practical
- Avoid unrelated renames, moves, or cleanup
- Preserve backward compatibility unless the task explicitly requires otherwise
- Avoid broad architectural rewrites
- Keep domain logic in services instead of templates or purely presentational components
- Do not silently change data shapes used across features
- Write unit tests for every new feature or service method introduced
- Update existing unit tests when changing functionality — never leave tests that pass but no longer reflect the real behavior

After making changes:

- Run `npm run build && npm run test -- --watch=false --browsers=ChromeHeadless` before committing any functional change — do not commit with a known build or test failure
- Summarize what changed
- Explain why the change was made
- Call out risks, tradeoffs, and follow-up work
- State what validation was performed
- If validation was not run, say so explicitly

---

## Planning Rules

Create a short written plan before implementation when the task is high-risk, cross-cutting, or likely to touch multiple surfaces.

Use a plan when the task involves:

- Firestore data model changes
- Firestore write-path changes
- auth or role logic changes
- guard or route access changes
- Jira callable contract changes
- dashboard or sprint-planning calculation changes
- shared UI primitives or theme refactors
- changes spanning both `src/` and `functions/`

A good plan should include:

1. scope
2. likely files or areas affected
3. main risks
4. validation approach
5. smallest safe implementation sequence

Prefer the smallest safe sequence over “big bang” implementation.

---

## Review Guidelines

When reviewing code, pay special attention to:

### Correctness

- date-driven calculations
- sprint metrics
- team capacity logic
- planning session behavior
- current vs next sprint targeting
- state synchronization between services and UI

### Security and access

- auth enforcement
- role checks
- team membership assumptions
- Firestore rules compatibility
- Jira callable authentication
- accidental credential exposure

### Architecture

- unnecessary duplication
- new abstractions without strong need
- business logic leaking into templates
- raw backend shapes leaking too deep into UI
- inconsistent service boundaries
- local feature problems being solved with global patterns

### UI and UX

- loading, empty, error, and disabled states
- dark theme regressions
- dialog consistency
- responsive layout issues
- inconsistent component styling
- planning-flow clarity and visibility of active participant interactions

### Data and contracts

- breaking changes to service return types
- breaking changes to callable response shapes
- Firestore key assumptions
- document path assumptions
- serialization or mapping inconsistencies

Flag as critical:

- auth bypass
- Firestore rules mismatch
- Jira credential exposure
- data corruption risk
- broken planning target logic
- silent date or timezone regression
- breaking contract change without coordinated updates

---

## Validation and Verification

Use the smallest relevant validation first, then expand if needed.

### Frontend

- Run `npm run build` after frontend changes when feasible
- Run `npm run test` for logic-heavy Angular changes if the area has coverage
- Verify compile-time safety for changed types, templates, and imports
- For UI work, validate impacted states and theme behavior when possible

### Firebase / Firestore

- Verify relevant rule assumptions before changing persistence behavior
- Validate emulator behavior for critical Firestore or Functions changes when feasible
- Do not claim Firestore behavior is correct without checking likely rules impact

### Jira

- Validate authenticated callable flows
- Validate missing-config and error states
- Validate caller expectations against callable response shape

### Documentation

- For `AGENTS.md` and similar repo-instruction files, verify claims against the current source instead of preserving outdated assumptions

If validation could not be run, state exactly what was not verified.

---

## Do Not

- Do not move Jira credentials or privileged Jira logic into frontend code
- Do not bypass Firestore rules with UI assumptions
- Do not introduce a new global state management approach for a local problem
- Do not convert surrounding observable-based code to signals-only without clear benefit
- Do not add duplicate Firestore, dialog, or date helpers when an existing utility already fits
- Do not perform large stylistic or architectural refactors during feature work
- Do not change callable response shapes without checking all affected Angular callers
- Do not weaken auth, role, or team-membership constraints for convenience
- Do not silently change current sprint / next sprint planning assumptions
- Do not ship UI changes that ignore dark theme, loading, or error states

---

## Expected Final Output

For implementation tasks, conclude with:

1. what changed
2. why
3. risks or follow-ups
4. validation performed

For review tasks, conclude with:

1. critical issues
2. important issues
3. minor improvements
4. missing validation
5. overall verdict

Be explicit about uncertainty. Do not claim checks were performed if they were not.

---

## Development Commands

### Frontend

- Install frontend deps: `npm install`
- Start Angular app: `npm run start`
- Build frontend: `npm run build`
- Run frontend tests: `npm run test`
- Run tests headless / CI mode: `npm run test -- --watch=false --browsers=ChromeHeadless`

### Emulators

- Start Firebase emulators: `npm run start:emulators`
- This script currently sources `functions/.env` before launching the Firebase emulators

### Functions

- Install functions deps: `cd functions && npm install`

When working on Jira callable functions, validate both the Angular caller and the function response shape.

---

## Commit Conventions

- Use `inc-N: short description` for incremental feature work (e.g. `inc-3: readiness and context phases`)
- Use `fix:` for bug fixes, `test:` for test-only changes, `chore:` for tooling/config, `docs:` for documentation
- Keep the subject line under 72 characters and written in the imperative mood

---

## Testing Conventions

- Use `fixture.debugElement.query(By.css('.class')).nativeElement.click()` for clicking Angular Material buttons in tests — not `querySelector().click()`
- Use `fakeAsync` + `tick()` for async service calls; provide spy services via `useValue`
- Trigger `ngOnChanges` manually in tests: `component.ngOnChanges({ session: new SimpleChange(prev, next, isFirst) })`
- Include `NoopAnimationsModule` in every component test bed
- One `describe` block per component or utility; group related cases with nested `describe` blocks

---

## When Updating This File

- Keep it specific to this repository
- Prefer documenting real patterns already present in the codebase over idealized architecture
- Update this file when commands, major folders, data model boundaries, product direction, or coding conventions change
- Add new durable rules only when they are broadly useful across future tasks
- If the same review feedback appears repeatedly, encode it here as a repository rule
