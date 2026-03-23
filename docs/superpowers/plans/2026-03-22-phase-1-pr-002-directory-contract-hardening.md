# Phase 1 PR-002 Directory Contract Hardening Implementation Plan

> Status: Partially executed and later superseded. The explicit directory seams and narrowed `teams` read contract landed. The planned `users/{uid}` tightening path was not pursued because member pickers moved to backend candidate search, membership authority moved to a callable, and product confirmed broad signed-in `users` profile reads are intentional.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Advance `PR-002` with evidence instead of assumptions: remove the remaining ambiguous directory dependencies, shrink the unconditional team-directory query surface, and tighten only the rule contracts that emulator-backed query verification proves safe.

**Architecture:** This work stays incremental. First, make broad directory ownership explicit everywhere. Then reduce the team-directory query surface so joined users do not keep subscribing to the full `teams` collection when they no longer need it. Only after that should Firestore rules be tightened, and only with emulator-backed checks for the exact query shapes used by Angular callers. `users` read narrowing remains blocked until a narrower member-candidate contract exists and the current cross-user membership write path is addressed.

**Tech Stack:** Angular 18, Firebase Firestore, Firestore rules, Firebase Auth emulator, Jasmine/Karma

---

## File Structure

### Existing Files To Modify

- `src/app/core/services/team-directory.service.ts`
  - add explicit narrowed consumer helpers for joinable teams and candidate-user filtering
- `src/app/core/services/team-directory.service.spec.ts`
  - cover new pure helper behavior for team and user directory filtering
- `src/app/features/teams/teams/teams.component.ts`
  - stop using ambiguous `TeamService.getAllTeams()` for join-team data
- `src/app/features/settings/settings/settings.component.ts`
  - stop using ambiguous `TeamService.getAllTeams()` for available-team data
- `src/app/features/teams/team-settings/team-settings.component.ts`
  - stop using ambiguous `TeamService.getAllUsers()` for candidate-member data
- `src/app/core/services/team.service.ts`
  - keep only compatibility shims that clearly delegate to `TeamDirectoryService`
- `src/app/features/teams/teams/teams.component.ts`
  - stop keeping a full team-directory subscription active after the user already has a team
- `src/app/features/settings/settings/settings.component.ts`
  - split current-team loading from joinable-team discovery so joined users do not depend on the full team directory
- `firestore.rules`
  - only tighten contracts that are proven compatible with live query shapes
- `docs/security-access-inventory.md`
  - update inventory once narrowed contracts and blockers are clarified
- `docs/production-readiness-roadmap.md`
  - keep `PR-002` accurate if one side (`teams`) can move sooner than the blocked `users` side

### New Temporary Verification Files

- `.firebase.phase1.pr002.json`
  - local-only emulator config for isolated rule verification
- `/tmp/phase1-pr002-rules-check.cjs`
  - local-only scripted allow/deny verification for both direct reads and actual Angular query shapes

### Notes On Boundaries

- Do not combine this work with Phase 2 decomposition.
- Keep `planningSessions` rules untouched in this plan.
- Tighten `users` and `teams` reads separately so failures are attributable.
- Treat query-shape compatibility as part of rule verification; direct document allow/deny checks alone are not enough.
- The current member-management flows update another user's `users/{uid}.teamId`, which conflicts with the existing self-write-only rule. Do not claim join/manage flows are preserved unless that mismatch is either fixed or explicitly scoped out.
- If a current route depends on broader reads than expected, capture it in docs and stop before final rule tightening.

## Task 1: Route Remaining Broad-Read Callers Through Explicit Directory APIs

**Files:**
- Modify: `src/app/core/services/team-directory.service.ts`
- Modify: `src/app/core/services/team-directory.service.spec.ts`
- Modify: `src/app/features/teams/teams/teams.component.ts`
- Modify: `src/app/features/settings/settings/settings.component.ts`
- Modify: `src/app/features/teams/team-settings/team-settings.component.ts`
- Modify: `src/app/core/services/team.service.ts`
- Modify: `docs/security-access-inventory.md`
- Modify: `docs/production-readiness-roadmap.md`

- [ ] **Step 1: Write failing tests for the remaining pure directory helpers**

Extend `src/app/core/services/team-directory.service.spec.ts` with at least:

```ts
import { Team } from '../models/team.model';
import { filterJoinableTeams } from './team-directory.service';

it('filters joinable teams for a user and matches search text', () => {
  const teams: Team[] = [
    { id: 'a', name: 'Alpha', icon: 'A', managerId: 'm1', memberIds: [], createdAt: new Date() },
    { id: 'b', name: 'Beta', icon: 'B', managerId: 'm2', memberIds: ['user-1'], createdAt: new Date() },
    { id: 'g', name: 'Gamma', icon: 'G', managerId: 'm3', memberIds: [], createdAt: new Date() },
  ];

  expect(filterJoinableTeams(teams, 'user-1', 'ga').map((team) => team.id)).toEqual(['g']);
});
```

- [ ] **Step 2: Run focused test to verify it fails**

Run: `npm run test -- --watch=false --include src/app/core/services/team-directory.service.spec.ts`

Expected:
- FAIL because `filterJoinableTeams(...)` does not exist yet

- [ ] **Step 3: Implement the missing helper(s)**

Add `filterJoinableTeams(...)` to `src/app/core/services/team-directory.service.ts` and keep `filterCandidateUsers(...)` as the shared user-candidate filter.

- [ ] **Step 4: Repoint remaining callers to explicit directory ownership**

Update:

- `src/app/features/teams/teams/teams.component.ts`
  - inject `TeamDirectoryService`
  - replace `TeamService.getAllTeams()` with `TeamDirectoryService.getDirectoryTeams()`
  - use `filterJoinableTeams(...)` for the join-team list
- `src/app/features/settings/settings/settings.component.ts`
  - inject `TeamDirectoryService`
  - replace `TeamService.getAllTeams()` with `TeamDirectoryService.getDirectoryTeams()`
  - use `filterJoinableTeams(...)` or equivalent explicit helper for available teams
- `src/app/features/teams/team-settings/team-settings.component.ts`
  - inject `TeamDirectoryService`
  - replace `TeamService.getAllUsers()` with `TeamDirectoryService.getDirectoryUsers()`
  - reuse `filterCandidateUsers(...)` for `filteredUsers`

Keep behavior unchanged.

- [ ] **Step 5: Keep `TeamService` compatibility surface explicit**

Leave `getAllUsers()` / `getAllTeams()` only as compatibility shims with comments pointing to `TeamDirectoryService`. Do not expand their use.

- [ ] **Step 6: Update docs**

Update:

- `docs/security-access-inventory.md`
  - mark which callers have been migrated to explicit directory ownership
- `docs/production-readiness-roadmap.md`
  - note that all currently known broad-read callers now go through explicit directory contracts

- [ ] **Step 7: Re-run focused test and build**

Run:

```bash
npm run test -- --watch=false --include src/app/core/services/team-directory.service.spec.ts
npm run build
```

Expected:
- test PASS
- build PASS

- [ ] **Step 8: Commit**

```bash
git add src/app/core/services/team-directory.service.ts src/app/core/services/team-directory.service.spec.ts src/app/features/teams/teams/teams.component.ts src/app/features/settings/settings/settings.component.ts src/app/features/teams/team-settings/team-settings.component.ts src/app/core/services/team.service.ts docs/security-access-inventory.md docs/production-readiness-roadmap.md
git commit -m "refactor: route directory callers through explicit contracts"
```

## Task 2: Tighten `users/{uid}` Reads To Self, Same-Team, And Elevated Roles

**Files:**
- Modify: `src/app/features/teams/teams/teams.component.ts`
- Modify: `src/app/features/settings/settings/settings.component.ts`
- Modify: `docs/security-access-inventory.md`
- Modify: `docs/production-readiness-roadmap.md`

- [ ] **Step 1: Split post-join surfaces from join-discovery surfaces**

Update the route components so full team-directory reads are only active for users who can actually join a team:

- `src/app/features/teams/teams/teams.component.ts`
  - keep the join/discovery list only for `!hasTeam()`
  - avoid maintaining a full `getDirectoryTeams()` subscription after the user joins
- `src/app/features/settings/settings/settings.component.ts`
  - derive the current team from a membership-scoped read (`getTeamsForUser(...)` or direct `getTeam(...)`)
  - subscribe to directory teams only when the user has no team and the join list is actually needed

Keep behavior unchanged:

- joined users still see their current team and can leave it
- no-team users still see the joinable team list
- ceremony settings still load for the current team

- [ ] **Step 2: Run build verification**

Run: `npm run build`

Expected:
- PASS

- [ ] **Step 3: Update docs**

Update:

- `docs/security-access-inventory.md`
  - note that broad `teams` reads should now be limited to explicit join/discovery flows
- `docs/production-readiness-roadmap.md`
  - record that unconditional post-join team-directory subscriptions have been removed before any rules tightening

- [ ] **Step 4: Commit**

```bash
git add src/app/features/teams/teams/teams.component.ts src/app/features/settings/settings/settings.component.ts docs/security-access-inventory.md docs/production-readiness-roadmap.md
git commit -m "refactor: scope team directory reads to join flows"
```

## Task 3: Verify And Tighten `teams/{teamId}` Reads Against Real Query Shapes

**Files:**
- Modify: `firestore.rules`
- Modify: `docs/production-readiness-roadmap.md`

- [ ] **Step 1: Add rule intent to the roadmap**

Record the intended `teams/{teamId}` read contract:

- team members may read their team
- signed-in users with no team may read teams for join/discovery flow
- elevated roles may read broadly
- unrelated signed-in users who already belong to another team may not read arbitrary teams

- [ ] **Step 2: Implement minimal rule change**

Narrow the `teams/{teamId}` block to:

```text
allow read: if signedIn() && (
  isMember(teamId) ||
  hasNoTeam() ||
  isAdminOrManager()
);
```

Leave create/update/delete semantics unchanged.

- [ ] **Step 3: Run emulator verification for both direct reads and Angular query shapes**

Verify:

- team member reads own team successfully
- signed-in user with no team can read a joinable team
- unrelated user already in another team is denied
- elevated-role read succeeds
- `getTeamsForUser(uid)` membership queries still succeed
- the post-Task-2 joined-user settings/teams flows do not require full directory access anymore

Expected:
- behavior matches the intended contract

- [ ] **Step 4: Re-run compile verification**

Run: `npm run build`

Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add firestore.rules docs/production-readiness-roadmap.md
git commit -m "fix: narrow team reads"
```

## Task 4: Design And Verify A Narrower `users` Directory Contract Or Record The Blocker

**Files:**
- Modify: `docs/security-access-inventory.md`
- Modify: `docs/production-readiness-roadmap.md`

- [ ] **Step 1: Document the current blocker precisely**

Record that current member-management flows still depend on:

- broad `getDocs(collection(db, 'users'))` candidate lists
- cross-user writes to `users/{uid}.teamId` from `addMember(...)`, `removeMember(...)`, and `joinTeam(...)`
- self-write-only `users/{uid}` rules that do not currently match those write paths

- [ ] **Step 2: Choose one of two acceptable outcomes**

Only proceed with one of these evidence-backed outcomes:

- implement a narrower candidate-user contract plus a compatible membership-write path
- or explicitly defer `users/{uid}` narrowing and keep `PR-002` open with a recorded blocker

- [ ] **Step 3: If a `users` contract is implemented, run emulator verification**

Verify:

- self-read succeeds
- same-team teammate read succeeds
- elevated-role read of unrelated user succeeds
- unrelated non-elevated read fails
- the chosen membership-management write path still works or is explicitly out of scope

Expected:
- behavior matches the adopted contract

- [ ] **Step 4: Run final checkpoint verification**

Run:

```bash
npm run build
npm run test -- --watch=false --include src/app/core/services/planning-session-access.util.spec.ts --include src/app/core/services/team-directory.service.spec.ts
```

Expected:
- build PASS
- focused tests PASS

- [ ] **Step 5: Commit**

```bash
git add docs/production-readiness-roadmap.md docs/security-access-inventory.md
git commit -m "docs: record pr-002 contract status"
```

## PR-002 Acceptance Checklist

- [ ] Remaining known caller surfaces use `TeamDirectoryService` explicitly for directory-style reads
- [ ] `TeamService.getAllUsers()` / `getAllTeams()` are only temporary compatibility shims
- [ ] Post-join route surfaces no longer depend on a full `teams` directory subscription
- [ ] `teams/{teamId}` reads are no longer globally open to every signed-in user, or the exact blocker is documented
- [ ] `users/{uid}` reads are either narrowed or explicitly retained as an intentional documented contract
- [ ] Emulator allow/deny coverage exists for narrowed `teams` reads and query shapes
- [ ] If `users` reads stay broad, the documented contract explains why no narrowing shipped in this plan family
- [ ] `docs/security-access-inventory.md` matches the implemented caller/rule state
- [ ] `npm run build` passes at each major checkpoint

## Notes For Execution

- Keep local-only emulator artifacts untracked.
- If a supposedly safe rule change breaks an existing join/manage flow or query shape, stop and document the exact dependency instead of widening the rule silently.
- Do not mark `PR-002` done unless both the `teams` and `users` halves are either hardened or explicitly resolved with evidence.
- Do not start Phase 2 decomposition until `PR-002` is either closed or explicitly deferred with evidence.
