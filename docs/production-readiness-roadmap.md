# Win Plan Tracker Production Readiness Roadmap

Last updated: 2026-03-23
Baseline commit: `d3535ed`
Delivery mode: `audit-first roadmap`
Execution style: `low-risk incremental delivery`

## Overview

This document is the master technical roadmap for bringing Win Plan Tracker to a more production-ready state without broad rewrites.

It serves four purposes:

- capture the current technical baseline with evidence
- record audit findings in a consistent format
- define phased, low-risk implementation work
- track progress, decisions, and validation over time

This document is intentionally evidence-driven. Findings should point to code, configuration, or command output rather than opinion.

## Goals and Non-Goals

### Goals

- improve frontend architecture and decomposition
- align Firebase access rules with product intent and service behavior
- harden Functions and Jira integration contracts
- improve reliability, state handling, and error handling
- reduce type debt in high-risk areas
- establish meaningful test coverage for critical logic
- improve build/performance posture and delivery hygiene
- create a repeatable validation model for future work

### Non-Goals

- broad rewrites for aesthetics alone
- replacing working patterns without evidence of benefit
- redesigning product behavior unless needed for correctness, security, or maintainability
- mixing large implementation changes into the audit phase

## Current Baseline

### Repository State

- Baseline commit: `d3535ed`
- Working tree was clean at audit start
- Runtime surfaces:
  - Angular SPA in `src/`
  - Firebase Cloud Functions in `functions/`
  - Firestore and Realtime Database rules at repo root

### Verified Baseline Evidence

- `npm run build` succeeds on baseline
- Production build emits an initial bundle budget warning
- No `*.spec.ts` files are present under `src/` or `functions/`
- Angular schematics are configured with `skipTests: true`

### Build Snapshot

Evidence from `npm run build` on 2026-03-21:

- initial bundle total: `1.32 MB`
- initial budget warning threshold: `1.05 MB`
- warning overage: `271.86 kB`

Related config:

- `angular.json`
  - production initial budget: `1mb`
  - component style warning budget: `36kb`

### Size / Complexity Hotspots

Evidence from file-size scan:

- `src/app/features/sprints/sprint-planning/sprint-planning.component.ts`: 915 lines
- `src/app/features/sprints/sprint-planning/sprint-planning.component.html`: 629 lines
- `src/app/features/sprints/sprint-planning/sprint-planning.component.scss`: 972 lines
- `src/app/features/dashboard/dashboard/dashboard.component.ts`: 591 lines
- `src/app/features/calendar/calendar-grid/calendar-grid.component.ts`: 529 lines
- `src/app/features/calendar/calendar-grid/calendar-grid.component.scss`: 1851 lines
- `src/app/features/teams/teams/teams.component.ts`: 461 lines
- `src/app/features/teams/teams/teams.component.scss`: 1295 lines

### Risk Summary

- Build is passing, but not within intended bundle budget.
- Access control posture is weaker than product assumptions in some areas.
- Several route surfaces are oversized and mix orchestration, domain logic, mapping, and UI concerns.
- Test posture is effectively absent.
- Type safety and subscription discipline are inconsistent.

## Audit Findings

Severity scale:

- `critical`: likely security or integrity risk
- `high`: high-risk correctness or architectural blocker
- `medium`: material maintainability or reliability debt
- `low`: improvement opportunity with limited blast radius

Status scale:

- `open`
- `planned`
- `in_progress`
- `done`
- `deferred`

### Findings Summary

| ID | Severity | Area | Type | Summary | Phase | Status |
| --- | --- | --- | --- | --- | --- | --- |
| PR-001 | critical | firebase-rules | security | `planningSessions` are world-readable/writable to any signed-in user | Phase 1 | done |
| PR-002 | high | firebase-rules | security | Broad signed-in `users` profile reads are an intentional, verified product contract; `teams` reads remain narrowed to membership, no-team discovery, and elevated roles | Phase 1 | done |
| PR-003 | high | planning | architecture | Sprint planning surface is oversized and mixes workflow, state, placement logic, and persistence orchestration | Phase 2 | open |
| PR-004 | high | frontend | architecture | Calendar grid mixes rendering, calendar math, team loading, holiday fetch, and dialog orchestration | Phase 2 | open |
| PR-005 | high | frontend | architecture | Teams surface mixes data aggregation, filtering, presence, team actions, and dialog coordination | Phase 2 | open |
| PR-006 | medium | reliability | reliability | Presence tracking is driven by a root service constructor subscription with side effects and no explicit teardown | Phase 3 | open |
| PR-007 | medium | typing | maintainability | High-risk models and services still use `any` and weak timestamp typing | Phase 3 | open |
| PR-008 | medium | build | performance | Production build exceeds initial bundle warning budget | Phase 5 | open |
| PR-009 | high | testing | reliability | Project has no effective automated test coverage for critical logic paths | Phase 4 | open |
| PR-010 | medium | frontend | maintainability | Dashboard route surface is still large and likely to resist safe change | Phase 2 | open |
| PR-011 | high | firebase-rules | correctness | Team membership authority was previously client-side and incompatible with self-write-only `users/{uid}` rules; it now moves through a privileged backend callable | Phase 1 | done |

### Detailed Findings

#### PR-001

- Severity: `critical`
- Area: `firebase-rules`
- Type: `security`
- Summary: `planningSessions` are readable and writable by any authenticated user.
- Evidence:
  - `firestore.rules:140-145`
  - rule text: `allow read, write: if signedIn();`
  - current service surface stores planning drafts and completed sessions in `src/app/core/services/planning.service.ts`
- Current Risk:
  - any signed-in user can read or overwrite collaborative planning state unrelated to their team
  - this conflicts with production expectations for planning privacy and integrity
- Recommended Direction:
  - introduce an explicit access model for planning sessions before expanding planning features
  - require new planning-session documents to include string `teamId`
  - allow reads for signed-in users only when the session is scoped to their team
  - keep a temporary legacy fallback where docs without `teamId` are readable only by `createdBy`
  - require writes to reference a team the caller belongs to
  - align service writes, reads, and route behavior with the final rules
- Rule Intent / Status:
  - intended rule model for Task 3:
    - new planning docs require `teamId`
    - same-team users can read planning docs
    - legacy docs without `teamId` are temporarily readable only by `createdBy`
    - writes require authenticated membership in the referenced team
  - status:
    - rule model is implemented in `firestore.rules`
    - emulator verification passed for same-team read allow, cross-team read deny, legacy creator read allow, and legacy non-creator read deny
- Validation:
  - emulator verification of allowed and denied access paths
  - caller/service behavior checks after rules changes
- Phase: `Phase 1`
- Status: `done`

#### PR-002

- Severity: `high`
- Area: `firebase-rules`
- Type: `security`
- Summary: broad signed-in `users` profile reads are intentional and verified, while `teams` reads have been narrowed to the smallest safe contract that preserves join/discovery and membership-scoped access.
- Evidence:
  - `firestore.rules:65-83`
  - `users/{uid}`: `allow read: if signedIn();`
  - `teams/{teamId}`: `allow read: if signedIn() && (isMember(teamId) || hasNoTeam() || isAdminOrManager());`
- Current Risk:
  - the verified broad `users/{uid}` profile-read contract is easy to misread as a security gap if future work does not keep the documentation and service boundaries in sync
  - `teams` no longer needs full signed-in visibility for joined users, so the remaining risk is accidental contract drift rather than an unresolved access mismatch
- Recommended Direction:
  - keep the intentional broad `users` profile-read contract documented and verified
  - keep `teams` reads aligned with the now-scoped join/discovery and membership queries
  - preserve `TeamDirectoryService.getMembershipCandidates(...)` for member-management candidate discovery and treat any future `users` narrowing as a new product decision with paired UI/service changes
- Current Phase 1 Progress:
  - broad-read inventory is now captured in `docs/security-access-inventory.md`
  - broad signed-in `users` profile visibility is intentional, documented, and verified
  - broad user/team directory access is isolated behind `src/app/core/services/team-directory.service.ts`
  - all currently known directory-style callers now use explicit directory contracts or compatibility shims
  - the settings and teams screens now unsubscribe from the full `teams` directory once a user already belongs to a team
  - `teams/{teamId}` reads are now narrowed to team members, no-team discovery, and elevated roles
  - emulator verification passed for member direct read allow, no-team direct read allow, no-team collection query allow, unrelated-team deny, elevated direct read allow, and membership-scoped query-shape allow
  - member-management candidate discovery now goes through the backend `getTeamMembershipCandidates` callable and `TeamDirectoryService.getMembershipCandidates(...)`
  - add-member, manage-team, and team-settings no longer use `getDirectoryUsers()` for candidate selection
  - the candidate-search rollout includes a legacy `users.teamId` backfill utility for environments that still contain docs without `teamId`
  - `getDirectoryUsers()` and `TeamService.getAllUsers()` remain documented compatibility seams rather than unresolved blockers
  - `users/{uid}` hardening is no longer an open PR-002 mismatch; the remaining work is keeping the intentional contract and compatibility seams documented if future product requirements change
- Validation:
  - Firestore emulator checks for user/team reads across roles and actual query shapes
  - source-backed review against `firestore.rules`, the candidate-search rollout, and current team-directory callers
  - `node --test functions/team/getMembershipCandidates.test.js functions/team/backfillMissingUserTeamIds.test.js` -> `11 pass / 0 fail`
  - `npm run test -- --watch=false --browsers=ChromeHeadless --include=src/app/core/services/team-directory.service.spec.ts` -> `TOTAL: 6 SUCCESS`
  - `npm run test -- --watch=false --browsers=ChromeHeadless --include=src/app/features/teams/team-settings/team-settings.component.spec.ts` -> `TOTAL: 3 SUCCESS`
  - `npm run build` -> pass with the pre-existing initial bundle budget warning
- Phase: `Phase 1`
- Status: `done`

#### PR-011

- Severity: `high`
- Area: `firebase-rules`
- Type: `correctness`
- Summary: team membership mutations now run through a privileged backend callable, removing the prior mismatch between client-side cross-user writes and self-write-only `users/{uid}` rules.
- Evidence:
  - `functions/team/updateMembership.js`
  - `functions/index.js`
  - `src/app/core/services/team.service.ts`
  - `firestore.rules:67-70`
  - `match /users/{uid}` still says `allow write: if signedIn() && request.auth.uid == uid;`
  - frontend membership mutations now call `updateTeamMembership` instead of writing `users/{uid}` directly
- Current Risk:
  - the original client/rules mismatch is removed, but future changes must keep membership authority on the backend or redesign the flows entirely
  - backend and frontend contracts now need to stay aligned on `action`, `status`, and error semantics
- Recommended Direction:
  - keep team membership mutations behind the privileged callable unless product requirements explicitly move them back into a self-service-only model
  - treat callable response semantics (`updated` vs `noop`) as part of the stable contract
  - keep the `users/{uid}` profile-read contract documented separately from PR-011 so future work does not confuse membership authority with profile visibility
- Validation:
  - `node --test functions/team/updateMembership.test.js` -> `8 pass / 0 fail`
  - `npm run test -- --watch=false --browsers=ChromeHeadless --include=src/app/core/services/team.service.spec.ts` -> `TOTAL: 6 SUCCESS`
  - `npm run build` -> pass with pre-existing initial bundle budget warning
- Phase: `Phase 1`
- Status: `done`

#### PR-003

- Severity: `high`
- Area: `planning`
- Type: `architecture`
- Summary: sprint planning is implemented as a large route component with mixed responsibilities.
- Evidence:
  - `src/app/features/sprints/sprint-planning/sprint-planning.component.ts`: 915 lines
  - `src/app/features/sprints/sprint-planning/sprint-planning.component.html`: 629 lines
  - `src/app/features/sprints/sprint-planning/sprint-planning.component.scss`: 972 lines
  - file contains workflow state, sorting, placement logic, autosave, Jira loading, persistence coordination, and UI control state
- Current Risk:
  - hard to reason about correctness of planning behavior
  - expensive to test
  - small feature changes have wide blast radius
- Recommended Direction:
  - separate workflow state, task transformation, planning board placement logic, and persistence orchestration
  - keep the route component focused on page-level composition
- Validation:
  - build stays green
  - same planning flows work for new, resume, and read-only sessions
  - extracted units gain targeted tests
- Phase: `Phase 2`
- Status: `open`

#### PR-004

- Severity: `high`
- Area: `frontend`
- Type: `architecture`
- Summary: calendar grid mixes view concerns with calendar-domain computation and data orchestration.
- Evidence:
  - `src/app/features/calendar/calendar-grid/calendar-grid.component.ts`: 529 lines
  - imports and code combine date math, Firestore streams, public holiday fetch, dialog launching, sprint grouping, and row rendering
  - `src/app/features/calendar/calendar-grid/calendar-grid.component.scss`: 1851 lines
- Current Risk:
  - difficult to change calendar behavior safely
  - presentation and domain logic are tightly coupled
  - large stylesheet suggests weak UI composition boundaries
- Recommended Direction:
  - extract calendar data composition and sprint/day transformation logic into smaller units
  - break UI sections into smaller presentational subcomponents only where it reduces risk
- Validation:
  - month/week behavior parity
  - holiday loading, event create/edit/remove, and sprint display checks
- Phase: `Phase 2`
- Status: `open`

#### PR-005

- Severity: `high`
- Area: `frontend`
- Type: `architecture`
- Summary: teams page mixes data aggregation, filters, presence, event metrics, and dialog workflows in one route surface.
- Evidence:
  - `src/app/features/teams/teams/teams.component.ts`: 461 lines
  - component performs user/team loading, enrichment joins, event metrics, filtering, join-team state, and dialog coordination
  - `src/app/features/teams/teams/teams.component.scss`: 1295 lines
- Current Risk:
  - team management changes require editing multiple concerns in one place
  - team role, presence, and metrics behavior are hard to test in isolation
- Recommended Direction:
  - separate data composition for team member rows from route-level actions
  - isolate join/manage/edit flows behind smaller boundaries
- Validation:
  - admin team management and join/leave flows remain correct
  - presence and metrics rendering stay intact
- Phase: `Phase 2`
- Status: `open`

#### PR-006

- Severity: `medium`
- Area: `reliability`
- Type: `reliability`
- Summary: presence tracking is implemented as a root service with constructor-side subscriptions and write side effects.
- Evidence:
  - `src/app/core/services/presence.service.ts:36-68`
  - `src/app/shared/components/shell/shell.component.ts:43-46`
  - service is eagerly instantiated from the shell specifically to start global side effects
- Current Risk:
  - lifecycle and ownership of connection listeners are implicit
  - production issues in presence are harder to reason about and test
- Recommended Direction:
  - make presence lifecycle explicit
  - isolate side-effect setup from read-model helpers
  - avoid hidden app-wide behavior triggered by component injection alone
- Validation:
  - online/offline transitions still work in emulator/manual checks
  - no duplicate listeners on auth changes
- Phase: `Phase 3`
- Status: `open`

#### PR-007

- Severity: `medium`
- Area: `typing`
- Type: `maintainability`
- Summary: type debt remains in core models and service code.
- Evidence:
  - `src/app/core/models/team-member.model.ts:13-16` uses `any`
  - `src/app/core/services/team.service.ts` includes `(userSnap.data() as any)?.teamId`
  - several dashboard chart service casts rely on `as any`
- Current Risk:
  - weak compile-time guarantees around timestamps and Firestore mapping
  - easier to introduce silent data-shape regressions
- Recommended Direction:
  - normalize Firestore timestamp/date types in models
  - remove `any` from high-risk service and view-model paths first
- Validation:
  - build stays green
  - changed types compile across affected surfaces without template regressions
- Phase: `Phase 3`
- Status: `open`

#### PR-008

- Severity: `medium`
- Area: `build`
- Type: `performance`
- Summary: the app currently builds but misses the initial bundle warning budget.
- Evidence:
  - `npm run build` output on 2026-03-21: initial total `1.32 MB`
  - `angular.json:61-72` sets initial warning budget to `1mb`
- Current Risk:
  - slower first-load performance
  - additional features may push the app toward harder build failures
- Recommended Direction:
  - identify heavy initial imports
  - preserve and improve lazy boundaries before adding more route logic
  - review chart and shared-shell dependencies loaded in the initial graph
- Validation:
  - build warning reduced or eliminated
  - chunk distribution measured before/after
- Phase: `Phase 5`
- Status: `open`

#### PR-009

- Severity: `high`
- Area: `testing`
- Type: `reliability`
- Summary: there is effectively no automated test coverage for critical logic.
- Evidence:
  - no `*.spec.ts` files found under `src/` or `functions/`
  - `angular.json:8-36` configures schematics with `skipTests: true`
- Current Risk:
  - refactoring high-risk logic relies on manual confidence
  - hard to make low-risk incremental architecture changes
- Recommended Direction:
  - add tests where they protect critical paths first:
    - auth and role guards
    - planning transforms and persistence mapping
    - Jira response mapping
    - access-sensitive services/utilities
- Validation:
  - targeted test suite exists and runs
  - new refactors land with direct regression protection
- Phase: `Phase 4`
- Status: `open`

#### PR-010

- Severity: `medium`
- Area: `frontend`
- Type: `maintainability`
- Summary: dashboard remains a large mixed-responsibility route surface.
- Evidence:
  - `src/app/features/dashboard/dashboard/dashboard.component.ts`: 591 lines
  - route includes KPI composition, team availability aggregation, dialog orchestration, chart assembly, and sprint capacity derivation
- Current Risk:
  - dashboard changes are costly and can impact multiple views
  - testing domain calculations is harder than necessary
- Recommended Direction:
  - continue extraction of chart and calculation helpers
  - move remaining view-model and aggregation logic out of the route component where it materially reduces risk
- Validation:
  - dashboard metrics and dialogs remain behaviorally consistent
- Phase: `Phase 2`
- Status: `open`

## Target Architecture Principles

- Keep route components thin.
- Separate orchestration from transformation and domain rules.
- Treat checked-in Firebase rules as the source of truth for access.
- Keep privileged Jira logic on the server side.
- Prefer explicit typed contracts over implicit document shapes.
- Make global side effects and lifecycle ownership explicit.
- Extract smaller units only when the boundary is real and testable.
- Use validation evidence before claiming correctness.

## Phased Roadmap

### Phase 0: Baseline Audit

- Goal:
  - capture factual current-state evidence and define the roadmap
- Scope:
  - this document
  - build baseline
  - initial findings
- Acceptance Criteria:
  - roadmap document exists
  - initial findings are evidence-backed
  - phased plan is agreed
- Status: `in_progress`

### Phase 1: Security / Access / Contracts

- Goal:
  - align rules, auth boundaries, and client/server contracts with intended product behavior
- Scope:
  - Firestore rules
  - Realtime Database presence rules
  - Jira callable auth and response contract checks
  - planning session access model
- Initial Backlog:
  - resolve PR-001
  - document PR-002 closure and keep the verified profile-visibility contract stable
  - inventory all client flows that depend on broad reads
- Acceptance Criteria:
  - rules model is explicit and verified with emulator evidence
  - client flows still function against tightened/confirmed rules
- Status: `in_progress`

### Phase 2: Architecture / Decomposition

- Goal:
  - reduce blast radius in the largest frontend surfaces
- Scope:
  - sprint planning
  - calendar grid
  - teams
  - dashboard as needed
- Initial Backlog:
  - resolve PR-003
  - resolve PR-004
  - resolve PR-005
  - resolve PR-010
- Acceptance Criteria:
  - route components are thinner
  - extracted boundaries are meaningful and testable
  - no feature regressions in primary flows
- Status: `planned`

### Phase 3: Reliability / State / Typing

- Goal:
  - make async behavior and data contracts less fragile
- Scope:
  - side-effect ownership
  - subscriptions
  - error handling
  - critical type normalization
- Initial Backlog:
  - resolve PR-006
  - resolve PR-007
- Acceptance Criteria:
  - fewer hidden side effects
  - reduced `any` usage in high-risk code
  - explicit loading/error/empty handling across affected flows
- Status: `planned`

### Phase 4: Tests / Verification

- Goal:
  - establish regression protection for critical logic
- Scope:
  - unit/integration coverage for high-value surfaces
  - validation commands for each phase
- Initial Backlog:
  - resolve PR-009
- Acceptance Criteria:
  - critical logic has automated coverage
  - architecture changes are backed by tests where needed
- Status: `planned`

### Phase 5: Performance / Delivery Hygiene

- Goal:
  - reduce build and delivery risk before calling the system production-ready
- Scope:
  - bundle budget work
  - dependency/lazy-load review
  - configuration hygiene
  - release validation checklist
- Initial Backlog:
  - resolve PR-008
- Acceptance Criteria:
  - build posture improves materially
  - release checklist exists for production changes
- Status: `planned`

## Validation Matrix

| Surface | Minimum validation |
| --- | --- |
| Frontend compile safety | `npm run build` |
| High-risk logic changes | targeted tests for changed units |
| Firestore rules changes | emulator verification of allowed and denied paths |
| Functions / Jira contract changes | callable success + missing-config + auth failure checks |
| Route decomposition | build + manual smoke of impacted route flows |
| Performance work | before/after build output and chunk review |
| Documentation / roadmap changes | source-backed self-review against current code/config |

## Decision Log

| Date | Decision | Reason |
| --- | --- | --- |
| 2026-03-21 | Use one master roadmap document in-repo | User requested a single living document |
| 2026-03-21 | Use `audit-first roadmap` | Lowest-risk path for wide-scope production hardening |
| 2026-03-21 | Use `low-risk incremental delivery` | Avoid broad rewrites and preserve correctness while improving architecture |
| 2026-03-21 | `planningSessions` rules move to same-team access with creator-only legacy fallback | Narrowest compatible way to close the broad authenticated read/write exposure without breaking legacy docs immediately |
| 2026-03-22 | Isolate broad `users` / `teams` reads behind an explicit directory seam before tightening rules | Keeps Phase 1 low-risk while making current directory dependencies explicit and inventoried |
| 2026-03-22 | Broad signed-in reads of `users` remain temporarily intentional while `teams` reads are narrowed to membership, no-team discovery, and elevated roles | Current join/manage/directory flows no longer need full `teams` visibility after Task 2 scoped joined-user directory subscriptions away from the full collection |
| 2026-03-22 | Route remaining join/manage callers through `TeamDirectoryService` helpers before any rules changes | Removes ambiguous `TeamService.getAllUsers()` / `getAllTeams()` ownership from active feature code while preserving current behavior |
| 2026-03-22 | `teams` hardening under PR-002 must be verified against live Angular query shapes, not just direct document reads | Firestore rule changes can appear safe in isolated allow/deny checks while still breaking real collection queries |
| 2026-03-22 | `users/{uid}` hardening cannot be marked done until the cross-user membership write path has an explicit authority model | `TeamService.addMember(...)`, `joinTeam(...)`, and `removeMember(...)` currently mutate another user's team membership, which conflicts with the self-write-only rule |
| 2026-03-22 | Team membership authority moves to a privileged backend callable instead of expanding client-side cross-user write rights | This resolves PR-011 without weakening `users/{uid}` rules and keeps stale-membership validation on a server-authoritative path |
| 2026-03-22 | Legacy `planningSessions` without `teamId` still require follow-up migration work | Creator-only fallback is acceptable for Phase 1, but it should not remain the long-term contract |
| 2026-03-23 | Member-management candidate discovery moves to a backend callable instead of broad `users` collection reads in the browser | This removes the largest remaining active `users` read dependency without widening the frontend DTO or weakening least-privilege boundaries |
| 2026-03-23 | Broad signed-in `users` profile reads are intentional and verified | `TeamDirectoryService.getDirectoryUsers()` and `TeamService.getAllUsers()` remain compatibility seams, while member-management candidate pickers use `TeamDirectoryService.getMembershipCandidates(...)` |

## Progress Tracker

### Phase Status

| Phase | Status | Notes |
| --- | --- | --- |
| Phase 0: Baseline Audit | in_progress | Baseline captured, first findings recorded |
| Phase 1: Security / Access / Contracts | done | Phase 1 checkpoint is complete: `planningSessions` access is explicit and emulator-verified; broad signed-in `users` profile reads are an intentional verified contract; `teams` reads are scoped to members, no-team discovery, and elevated roles; PR-011 is closed via privileged membership callable; active member-pickers use backend candidate search |
| Phase 2: Architecture / Decomposition | planned | Depends on phase 1 boundaries being explicit |
| Phase 3: Reliability / State / Typing | planned | Follows initial decomposition and access stabilization |
| Phase 4: Tests / Verification | planned | Begins in parallel once first stable seams exist |
| Phase 5: Performance / Delivery Hygiene | planned | Build budget and release readiness pass |

### Immediate Next Steps

1. Move the Phase 2 decomposition work forward now that PR-002 is closed and the profile-visibility contract is documented.
2. Keep `getDirectoryUsers()` and `TeamService.getAllUsers()` as compatibility seams only until downstream callers are retired.
3. Preserve `TeamDirectoryService.getMembershipCandidates(...)` as the required path for member-management candidate discovery.

## Open Questions / Blockers

- PR-002 has no open blocker for broad signed-in `users` reads; any future narrowing would need a new product decision and coordinated service/UI changes.
- When should legacy `planningSessions` documents without `teamId` be backfilled or retired so the creator-only fallback can be removed?
- Should presence remain globally readable to all signed-in users, or only to relevant teammates?
- Is the current Jira board binding (`BOARD_ID = 1671` in sprint surfaces) expected to remain static, or should it become team/config driven?
- What level of automated test investment is acceptable before Phase 2 decomposition starts?
