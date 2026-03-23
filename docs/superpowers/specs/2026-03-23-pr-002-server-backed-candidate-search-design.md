# PR-002 Server-Backed Candidate Search Design

> Status: Implemented on 2026-03-23. This design landed through `getTeamMembershipCandidates(...)` and `TeamDirectoryService.getMembershipCandidates(...)`. PR-002 was later closed without `users/{uid}` rule tightening after the product decision to keep broad signed-in profile reads intentional and verified.

## Goal

Remove the remaining broad authenticated `users` collection reads from team member-management flows by replacing client-side full-directory loading with a privileged backend candidate-search callable.

## Problem

`PR-002` was still open when this design was written because several team-management screens depended on `TeamDirectoryService.getDirectoryUsers()`, which did `getDocs(collection(db, 'users'))` and then filtered in the browser.

That broad read still powers:

- `src/app/features/teams/add-member-dialog/add-member-dialog.component.ts`
- `src/app/features/teams/manage-team-dialog/manage-team-dialog.component.ts`
- `src/app/features/teams/team-settings/team-settings.component.ts`

After `PR-011`, team membership writes already moved to the privileged `updateTeamMembership` callable. The remaining least-privilege gap is now read-side only.

## Chosen Approach

Use a thin Firebase callable to return only join-eligible member candidates for a specific team.

This keeps filtering and authority on the backend, matches the newly established server-authoritative membership boundary, and unblocks future tightening of `users/{uid}` reads without forcing denormalized Firestore-only workarounds.

## Alternatives Considered

### 1. Firestore-only narrowing

Keep everything in the browser and redesign the query model with more Firestore indexes or denormalized candidate docs.

Why not now:

- higher rules/query-shape risk
- more schema work
- more moving parts than the current problem needs

### 2. Defer `users` hardening and move to Phase 2

Leave broad `users` reads in place temporarily and continue with decomposition work first.

Why not now:

- leaves `PR-002` materially unresolved
- keeps access posture broader than product intent

### 3. Recommended: server-backed candidate search

Use a callable that applies authority checks plus candidate filtering server-side and returns a minimal list to existing dialogs.

Why this wins:

- smallest safe change
- aligns with the new backend ownership for membership authority
- cleanly separates read hardening from future UI decomposition

## Architecture

### Backend

Add a new callable, tentatively named `getTeamMembershipCandidates`.

Input:

- `teamId: string`
- optional `search: string`

Authority:

- allow only the current manager of `teamId`
- deny unrelated users, including authenticated admins/managers who are not the current team manager

Rationale:

- this keeps the candidate-search boundary aligned with the already-shipped `updateTeamMembership` callable, where `add` and `remove` remain manager-authoritative
- current route guards are stricter in places, but the backend contract should match the actual mutation authority, not a hypothetical future access model

Filtering contract:

- exclude current members already present in `teams/{teamId}.memberIds`
- exclude users whose `teamId` points to another team
- allow same-team repair candidates where `user.teamId === teamId` but the team doc is missing that user
- support server-side search by `displayName` and `email`
- return a small, UI-safe payload only

Response shape:

- array of lightweight candidate user objects
- only fields needed by current dialogs:
  - `uid`
  - `displayName`
  - `email`
  - `photoURL`
  - `teamId`

Frontend type:

- introduce a dedicated candidate type, for example `TeamMembershipCandidate`
- do not reuse `AppUser`, because the candidate payload intentionally omits fields such as `role` and `createdAt`

Implementation notes:

- keep the callable thin
- place filtering logic in a pure helper so it can be tested directly
- do not mix membership mutation behavior into this callable

### Frontend

Replace current full-directory loading in:

- `add-member-dialog.component.ts`
- `manage-team-dialog.component.ts`
- `team-settings.component.ts`

with a narrow API on `TeamDirectoryService`, backed by the new callable.

Suggested service shape:

- `getMembershipCandidates(teamId: string, search?: string): Promise<TeamMembershipCandidate[]>`

UI behavior:

- preserve current loading/error/search flow as much as practical
- keep local search state in the component
- either:
  - call the backend on every trimmed search change with simple debounce, or
  - fetch the initial filtered candidate set once and keep the existing local search helper for in-memory refinement

Preferred first step:

- fetch the safe candidate set once on open
- keep current local search UX over the already-safe result list

That is lower risk than introducing search-triggered network churn immediately.

## Data And Contract Boundaries

### Stable Boundary

The browser should no longer assume that reading the full `users` directory is valid for member-management flows.

Instead:

- member-management candidate visibility becomes an explicit backend contract
- `TeamDirectoryService` owns the app-facing candidate API
- dialogs/components stay orchestration-focused

### Compatibility

- no change to existing add/remove/join/leave UI flows
- no change to current team-member enrichment writes
- no change to the already-shipped `updateTeamMembership` callable contract

## Error Handling

Backend:

- use `functions.https.HttpsError`
- preserve `unauthenticated`, `permission-denied`, `invalid-argument`, and `unknown` semantics

Frontend:

- surface existing fallback messages through `getErrorMessage(...)`
- keep current loading and error states in the dialogs/pages

## Validation

### Backend

- focused Node tests for candidate filtering helper and callable authority
- cover:
  - manager allow
  - authenticated non-manager deny, even when the caller has an elevated app role
  - unrelated caller deny
  - exclude other-team users
  - include same-team repair candidates
  - exclude existing team members

### Frontend

- focused Jasmine/Karma tests for `TeamDirectoryService` callable wrapper and candidate DTO mapping
- focused component/service tests only if needed for loading/error behavior
- `npm run build`

### Access Follow-Up

This candidate API landed. The follow-up decision for `users/{uid}` was not further tightening in Phase 1; broad signed-in profile reads were intentionally retained and emulator-verified as the checked-in contract.

## Out Of Scope

- broad decomposition of teams UI
- redesigning invite/member management UX
- replacing current local search with advanced remote typeahead
- tightening `users/{uid}` rules in the same implementation step unless validation shows it is trivially safe afterward

## Expected Outcome

When this design is implemented:

- team member-management screens no longer need full `users` collection reads
- `PR-002` is materially reduced to a final contract-closure follow-up
- the repo keeps a consistent backend ownership model for membership-related authority
