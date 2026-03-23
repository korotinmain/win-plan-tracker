# Phase 1 Security / Access / Contracts Implementation Plan

> Status: Phase 1 checkpoint updated on 2026-03-23. PR-001, PR-011, and PR-002 closure work from this plan family have landed. Historical notes about future `users/{uid}` tightening should now be read alongside the roadmap decision that broad signed-in profile reads remain intentional and verified.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tighten the highest-risk access and contract issues first by scoping sprint planning data, documenting and isolating broad-read dependencies, and adding the first regression checks needed for safe future hardening.

**Architecture:** This phase avoids broad rewrites. It first introduces explicit planning-session access fields and client-side scoping, then aligns Firestore rules with that model using a backward-compatible path for existing documents. Broad reads of `users` and `teams` are not tightened blindly; instead, the codebase first gets explicit service seams and a documented dependency inventory so later rules changes are safe and deliberate.

**Tech Stack:** Angular 18, AngularFire Functions, Firebase Firestore, Firebase Realtime Database, Firebase Cloud Functions, Jasmine/Karma, Firebase emulators

---

## File Structure

### Existing Files To Modify

- `firestore.rules`
  - tighten `planningSessions` access rules
  - leave `users` / `teams` rules unchanged until client dependencies are isolated
- `src/app/core/services/planning.service.ts`
  - add explicit planning-session scoping fields and scoped query methods
- `src/app/core/services/jira.service.ts`
  - keep callable contract types aligned if payload or return types need clarifying during planning-session work
- `src/app/features/jira/jira.component.ts`
  - switch planning-history, draft, and completed-session reads to scoped service methods
- `src/app/features/sprints/sprint-planning/sprint-planning.component.ts`
  - ensure draft creation / completion paths write scoped planning-session metadata
- `src/app/core/services/team.service.ts`
  - introduce explicit narrow-read helpers or clearly named broad-read helpers for user/team directory flows
- `src/app/features/teams/manage-team-dialog/manage-team-dialog.component.ts`
  - stop depending on ambiguous `getAllUsers()` naming
- `src/app/features/teams/add-member-dialog/add-member-dialog.component.ts`
  - stop depending on ambiguous `getAllUsers()` naming
- `docs/production-readiness-roadmap.md`
  - update finding statuses, decisions, and progress after each completed task

### New Files To Create

- `src/app/core/services/planning-session-access.util.ts`
  - pure helper(s) for building and normalizing scoped planning-session payloads
- `src/app/core/services/planning-session-access.util.spec.ts`
  - first unit tests for planning-session access metadata and legacy compatibility behavior
- `src/app/core/services/team-directory.service.ts`
  - explicit read surface for user/team directory and membership-management flows
- `src/app/core/services/team-directory.service.spec.ts`
  - tests for directory filtering / access-shape helpers
- `docs/security-access-inventory.md`
  - inventory of every feature currently depending on broad reads of `users` and `teams`

### Notes On Boundaries

- Do not turn this phase into a full planning refactor. Only extract helpers when they directly reduce access-risk and testability problems.
- Do not tighten `users` / `teams` rules until the dependency inventory and service seams exist.
- Prefer backward-compatible data model additions to destructive schema changes.

## Task 1: Add Initial Test Seams For Planning Session Access

**Files:**
- Create: `src/app/core/services/planning-session-access.util.ts`
- Create: `src/app/core/services/planning-session-access.util.spec.ts`
- Modify: `src/app/core/services/planning.service.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/app/core/services/planning-session-access.util.spec.ts` with focused pure tests for:

```ts
import {
  buildPlanningSessionAccessFields,
  canReadLegacyPlanningSession,
} from './planning-session-access.util';

describe('planning-session-access util', () => {
  it('adds team and participant access metadata for new planning docs', () => {
    expect(
      buildPlanningSessionAccessFields({
        teamId: 'team-1',
        createdBy: 'user-1',
        participantIds: ['user-1', 'user-2'],
      }),
    ).toEqual({
      teamId: 'team-1',
      createdBy: 'user-1',
      participantIds: ['user-1', 'user-2'],
    });
  });

  it('allows creator fallback for legacy docs without teamId', () => {
    expect(
      canReadLegacyPlanningSession(
        { createdBy: 'user-1', teamId: undefined },
        'user-1',
      ),
    ).toBeTrue();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --watch=false --include src/app/core/services/planning-session-access.util.spec.ts`

Expected:
- FAIL because `planning-session-access.util.ts` does not exist yet

- [ ] **Step 3: Write minimal implementation**

Create `src/app/core/services/planning-session-access.util.ts` with minimal pure helpers:

```ts
export interface PlanningSessionAccessFields {
  teamId: string;
  createdBy: string;
  participantIds: string[];
}

export function buildPlanningSessionAccessFields(
  data: PlanningSessionAccessFields,
): PlanningSessionAccessFields {
  return {
    teamId: data.teamId,
    createdBy: data.createdBy,
    participantIds: Array.from(new Set(data.participantIds)),
  };
}

export function canReadLegacyPlanningSession(
  session: { createdBy?: string; teamId?: string },
  uid: string,
): boolean {
  return !session.teamId && session.createdBy === uid;
}
```

- [ ] **Step 4: Integrate the helper into `PlanningService` types**

Update `src/app/core/services/planning.service.ts` so `PlanningSession` and draft payloads explicitly support:

```ts
teamId: string;
participantIds: string[];
```

Keep the change additive and backward-compatible for existing documents.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test -- --watch=false --include src/app/core/services/planning-session-access.util.spec.ts`

Expected:
- PASS for the new util tests

- [ ] **Step 6: Commit**

```bash
git add src/app/core/services/planning-session-access.util.ts src/app/core/services/planning-session-access.util.spec.ts src/app/core/services/planning.service.ts
git commit -m "test: add planning session access test seam"
```

## Task 2: Scope New Planning Session Writes And Reads

**Files:**
- Modify: `src/app/core/services/planning.service.ts`
- Modify: `src/app/features/jira/jira.component.ts`
- Modify: `src/app/features/sprints/sprint-planning/sprint-planning.component.ts`
- Test: `src/app/core/services/planning-session-access.util.spec.ts`

- [ ] **Step 1: Extend the failing tests for scoped reads**

Add tests that define the target behavior for scoped query inputs:

```ts
it('requires a non-empty teamId for new planning-session writes', () => {
  expect(() =>
    buildPlanningSessionAccessFields({
      teamId: '',
      createdBy: 'user-1',
      participantIds: ['user-1'],
    }),
  ).toThrow();
});
```

If you choose not to throw in the helper, adjust the test to assert that the service rejects empty `teamId` before write.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --watch=false --include src/app/core/services/planning-session-access.util.spec.ts`

Expected:
- FAIL because empty-team validation is not implemented yet

- [ ] **Step 3: Update `PlanningService` to write scoped metadata**

Implement the smallest safe service changes:

- add `teamId` and `participantIds` to draft creation
- reject new writes when current user has no `teamId`
- keep read methods backward-compatible, but create scoped methods for new callers:

```ts
getActiveDraftForSprint(teamId: string, sprintName: string): Promise<PlanningSession | null>
getCompletedForSprint(teamId: string, sprintName: string): Promise<PlanningSession | null>
getSessionsForTeam(teamId: string): Promise<PlanningSession[]>
```

For `getSessionById`, keep document-by-id loading, but expect rules to enforce access after Task 3.

- [ ] **Step 4: Update route callers**

Update:

- `src/app/features/jira/jira.component.ts`
  - use `currentUser.teamId`
  - call new scoped planning-service methods
- `src/app/features/sprints/sprint-planning/sprint-planning.component.ts`
  - ensure draft creation includes `teamId`
  - include `participantIds` derived from selected participants or resolved members

Do not change visible product behavior in this task.

- [ ] **Step 5: Run compile verification**

Run: `npm run build`

Expected:
- PASS

- [ ] **Step 6: Run focused tests**

Run: `npm run test -- --watch=false --include src/app/core/services/planning-session-access.util.spec.ts`

Expected:
- PASS

- [ ] **Step 7: Commit**

```bash
git add src/app/core/services/planning.service.ts src/app/features/jira/jira.component.ts src/app/features/sprints/sprint-planning/sprint-planning.component.ts src/app/core/services/planning-session-access.util.spec.ts
git commit -m "feat: scope planning session reads and writes"
```

## Task 3: Tighten `planningSessions` Firestore Rules With Legacy Fallback

**Files:**
- Modify: `firestore.rules`
- Modify: `docs/production-readiness-roadmap.md`

- [ ] **Step 1: Write rule expectations into the roadmap**

Update the roadmap and note the rule intent before editing the rules:

- new planning docs require `teamId`
- same-team users can read planning docs
- legacy docs without `teamId` are temporarily readable only by `createdBy`
- writes require authenticated membership in the referenced team

- [ ] **Step 2: Implement minimal rule change**

Update the `planningSessions` rule block in `firestore.rules` to follow this shape:

```text
allow read: if signedIn() && (
  (resource.data.teamId is string && isMember(resource.data.teamId)) ||
  (!(resource.data.teamId is string) && resource.data.createdBy == request.auth.uid)
);

allow create: if signedIn()
  && request.resource.data.teamId is string
  && isMember(request.resource.data.teamId)
  && request.resource.data.createdBy == request.auth.uid;

allow update, delete: if signedIn() && (
  (resource.data.teamId is string && isMember(resource.data.teamId)) ||
  resource.data.createdBy == request.auth.uid
);
```

Adjust syntax to valid Firestore rules language while preserving the above intent.

- [ ] **Step 3: Run emulator-oriented verification**

Run: `npm run start:emulators`

Verify manually or with scripted requests:

- same-team read succeeds for a scoped planning session
- cross-team read fails
- legacy creator read succeeds for a doc without `teamId`
- legacy non-creator read fails

Expected:
- behavior matches the intended access model

- [ ] **Step 4: Re-run compile verification**

Run: `npm run build`

Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add firestore.rules docs/production-readiness-roadmap.md
git commit -m "fix: scope planning session firestore access"
```

## Task 4: Document And Isolate Broad `users` / `teams` Read Dependencies

**Files:**
- Create: `docs/security-access-inventory.md`
- Create: `src/app/core/services/team-directory.service.ts`
- Create: `src/app/core/services/team-directory.service.spec.ts`
- Modify: `src/app/core/services/team.service.ts`
- Modify: `src/app/features/teams/manage-team-dialog/manage-team-dialog.component.ts`
- Modify: `src/app/features/teams/add-member-dialog/add-member-dialog.component.ts`
- Modify: `docs/production-readiness-roadmap.md`

- [ ] **Step 1: Write the access inventory**

Create `docs/security-access-inventory.md` and list every current feature using broad reads of:

- `users`
- `teams`

Include:

- feature
- file(s)
- current query shape
- whether the read appears required or incidental
- candidate future narrowing strategy

Start with at least:

- `TeamService.getAllUsers()`
- `TeamService.getAllTeams()`
- add-member and manage-team dialogs
- join-team flow

- [ ] **Step 2: Write failing tests for the new service seam**

Create `src/app/core/services/team-directory.service.spec.ts` with tests for pure helper or service behavior naming, for example:

```ts
describe('TeamDirectoryService helpers', () => {
  it('filters out existing member ids from candidate users', () => {
    expect(
      filterCandidateUsers(
        [
          { uid: '1', email: 'a@x.com', displayName: 'A' },
          { uid: '2', email: 'b@x.com', displayName: 'B' },
        ],
        ['1'],
      ).map((u) => u.uid),
    ).toEqual(['2']);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm run test -- --watch=false --include src/app/core/services/team-directory.service.spec.ts`

Expected:
- FAIL because the new service/helper does not exist yet

- [ ] **Step 4: Implement the explicit directory service**

Create `src/app/core/services/team-directory.service.ts` to hold intentionally broad directory flows, for example:

- `getDirectoryUsers(): Promise<AppUser[]>`
- `getDirectoryTeams(): Observable<Team[]>`
- helper(s) for filtering candidate users

Then update:

- `TeamService`
  - keep team-domain methods only
  - either remove `getAllUsers()` / `getAllTeams()` or mark them deprecated and delegate to the new service
- `ManageTeamDialogComponent`
- `AddMemberDialogComponent`

The objective is not to reduce reads yet. The objective is to make broad reads explicit and isolated.

- [ ] **Step 5: Run tests and build**

Run:

```bash
npm run test -- --watch=false --include src/app/core/services/team-directory.service.spec.ts
npm run build
```

Expected:
- tests PASS
- build PASS

- [ ] **Step 6: Commit**

```bash
git add docs/security-access-inventory.md src/app/core/services/team-directory.service.ts src/app/core/services/team-directory.service.spec.ts src/app/core/services/team.service.ts src/app/features/teams/manage-team-dialog/manage-team-dialog.component.ts src/app/features/teams/add-member-dialog/add-member-dialog.component.ts docs/production-readiness-roadmap.md
git commit -m "refactor: isolate broad directory reads"
```

## Task 5: Freeze Phase 1 Decisions In The Roadmap

**Files:**
- Modify: `docs/production-readiness-roadmap.md`

- [ ] **Step 1: Update findings and progress**

After Tasks 1-4:

- mark PR-001 as `done` or `in_progress` depending on completion state
- update PR-002 to reflect whether broad reads are inventoried, tightened, or later closed as an intentional verified contract
- record any new findings discovered during implementation

- [ ] **Step 2: Add a decision-log entry**

Record:

- the chosen planning-session access model
- whether global user/team reads remain temporarily intentional
- whether additional migration work is required for legacy planning docs

- [ ] **Step 3: Run final verification for the phase checkpoint**

Run:

```bash
npm run build
```

If tests were added in this phase, also run:

```bash
npm run test -- --watch=false --include src/app/core/services/planning-session-access.util.spec.ts --include src/app/core/services/team-directory.service.spec.ts
```

Expected:
- build PASS
- newly added focused tests PASS

- [ ] **Step 4: Commit**

```bash
git add docs/production-readiness-roadmap.md
git commit -m "docs: update phase 1 roadmap status"
```

## Phase 1 Acceptance Checklist

- [ ] New planning sessions store explicit `teamId` and `participantIds`
- [ ] Jira / sprint planning UI reads planning data through scoped methods
- [ ] `planningSessions` Firestore rules are no longer open to every signed-in user
- [ ] Legacy planning sessions have a documented temporary compatibility path
- [ ] Broad `users` / `teams` read dependencies are inventoried
- [ ] Broad directory reads are isolated behind explicit service boundaries
- [ ] At least two focused spec files exist and run
- [ ] `npm run build` passes after each major checkpoint

## Notes For Execution

- Keep commits small and phase-safe.
- Do not combine Phase 1 security work with Phase 2 decomposition work.
- If tightening `users` / `teams` rules would break current join/manage flows, stop after isolating those reads and capture the blocker in the roadmap.
- If emulator verification cannot be completed in-session, record the exact missing evidence in the roadmap rather than claiming success.
