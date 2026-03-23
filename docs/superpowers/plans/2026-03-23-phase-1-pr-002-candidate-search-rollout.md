# PR-002 Candidate Search Rollout Implementation Plan

> Status: Landed on 2026-03-23. The backend candidate-search callable and Angular migration are complete. This plan remains as execution history; PR-002 was later closed by documenting intentional broad signed-in `users` profile reads rather than tightening `users/{uid}` rules.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the remaining broad `users` collection reads from team member-management candidate pickers by replacing them with a server-backed candidate-search callable and a narrow frontend service contract.

**Architecture:** Add one thin Firebase callable that returns only manager-authorized, join-eligible membership candidates for a specific team. Keep the Angular UI low-risk by routing existing dialogs/pages through `TeamDirectoryService.getMembershipCandidates(...)`, preserving current loading/search behavior with in-memory filtering over an already-safe result set.

**Tech Stack:** Angular 18, AngularFire Functions, Firebase Cloud Functions (CommonJS), Firestore, Firebase Auth, Jasmine/Karma, Node 20 test runner

---

## File Structure

### Existing Files To Modify

- `functions/index.js`
  - export the new candidate-search callable
- `src/app/core/services/team-directory.service.ts`
  - add a callable-backed candidate API and dedicated DTO type
- `src/app/core/services/team-directory.service.spec.ts`
  - cover candidate DTO mapping and wrapper behavior
- `src/app/features/teams/add-member-dialog/add-member-dialog.component.ts`
  - switch from `getDirectoryUsers()` to `getMembershipCandidates(...)`
- `src/app/features/teams/manage-team-dialog/manage-team-dialog.component.ts`
  - switch from `getDirectoryUsers()` to `getMembershipCandidates(...)`
- `src/app/features/teams/team-settings/team-settings.component.ts`
  - switch from `getDirectoryUsers()` to `getMembershipCandidates(...)`
- `docs/security-access-inventory.md`
  - record that member pickers no longer require full `users` reads
- `docs/production-readiness-roadmap.md`
  - update PR-002 progress and next blocker status
- `AGENTS.md`
  - document the new candidate-search boundary if it becomes durable guidance

### New Files To Create

- `functions/team/getMembershipCandidates.js`
  - thin callable plus pure filtering helper
- `functions/team/getMembershipCandidates.test.js`
  - Node test-runner coverage for callable filtering/authority

### Boundaries

- Do not tighten `users/{uid}` rules in this plan.
- Do not redesign the add/manage/team-settings UI.
- Do not touch the existing `updateTeamMembership` callable unless a blocking integration issue appears.
- Keep the frontend search UX local-first after the initial candidate fetch.
- In any environment that still has legacy `users` docs missing `teamId`, run the one-off backfill script before switching member pickers to server-backed candidate search.

---

### Task 1: Add The Backend Candidate Callable

**Files:**
- Modify: `functions/index.js`
- Create: `functions/team/getMembershipCandidates.js`
- Create: `functions/team/getMembershipCandidates.test.js`

- [ ] **Step 1: Write the failing backend tests**

Create `functions/team/getMembershipCandidates.test.js` with pure-helper coverage for:

```js
test("manager gets only join-eligible candidates for the target team", () => {});
test("non-manager caller is denied", () => {});
test("same-team repair candidates remain included", () => {});
test("existing members and other-team users are excluded", () => {});
```

- [ ] **Step 2: Run the backend test to verify it fails**

Run:

```bash
node --test functions/team/getMembershipCandidates.test.js
```

Expected:
- FAIL because the module/helper does not exist yet

- [ ] **Step 3: Implement the minimal backend callable**

Create `functions/team/getMembershipCandidates.js` with:

- a dedicated candidate DTO mapper:
  - `uid`
  - `displayName`
  - `email`
  - `photoURL`
  - `teamId`
- a pure helper that:
  - accepts team doc, candidate users, caller uid
  - enforces manager-only access
  - excludes users already present in `team.memberIds`
  - excludes users assigned to another team
  - includes same-team repair candidates (`user.teamId === team.id` but missing from `memberIds`)
  - supports optional trimmed search on `displayName` and `email`
- a thin callable that:
  - requires auth
  - validates `teamId`
  - loads the target team and candidate user documents
  - returns `{ candidates: TeamMembershipCandidate[] }`
  - throws `functions.https.HttpsError` with stable codes

- [ ] **Step 4: Export the callable**

Update `functions/index.js` to export the new callable, e.g. `getTeamMembershipCandidates`.

- [ ] **Step 5: Run backend verification**

Run:

```bash
node --test functions/team/getMembershipCandidates.test.js
node --check functions/team/getMembershipCandidates.js
node --check functions/index.js
```

Expected:
- all tests PASS
- syntax checks PASS

- [ ] **Step 6: Commit the backend slice**

```bash
git add functions/index.js functions/team/getMembershipCandidates.js functions/team/getMembershipCandidates.test.js
git commit -m "feat: add membership candidate callable"
```

---

### Task 2: Add A Narrow Frontend Candidate API

**Files:**
- Modify: `src/app/core/services/team-directory.service.ts`
- Modify: `src/app/core/services/team-directory.service.spec.ts`

- [ ] **Step 1: Write the failing frontend service tests**

Extend `src/app/core/services/team-directory.service.spec.ts` to cover:

```ts
it('maps callable candidates into the dedicated frontend candidate type', async () => {});
it('passes teamId and optional search to the callable wrapper', async () => {});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

```bash
npm run test -- --watch=false --browsers=ChromeHeadless --include=src/app/core/services/team-directory.service.spec.ts
```

Expected:
- FAIL because the candidate API and/or DTO type does not exist yet

- [ ] **Step 3: Implement the minimal frontend contract**

Update `src/app/core/services/team-directory.service.ts` to:

- add a dedicated frontend type, e.g.:

```ts
export interface TeamMembershipCandidate {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  teamId: string;
}
```

- add a callable wrapper:

```ts
async getMembershipCandidates(
  teamId: string,
  search = '',
): Promise<TeamMembershipCandidate[]>
```

- keep `filterCandidateUsers(...)` only if it remains useful for in-memory search refinement over the safe candidate set; otherwise narrow or replace it

- [ ] **Step 4: Re-run the focused service test**

Run:

```bash
npm run test -- --watch=false --browsers=ChromeHeadless --include=src/app/core/services/team-directory.service.spec.ts
```

Expected:
- PASS

- [ ] **Step 5: Commit the service slice**

```bash
git add src/app/core/services/team-directory.service.ts src/app/core/services/team-directory.service.spec.ts
git commit -m "feat: add candidate search service contract"
```

---

### Task 3: Move Member Pickers To The Candidate API

**Files:**
- Modify: `src/app/features/teams/add-member-dialog/add-member-dialog.component.ts`
- Modify: `src/app/features/teams/manage-team-dialog/manage-team-dialog.component.ts`
- Modify: `src/app/features/teams/team-settings/team-settings.component.ts`
- Optionally create: `src/app/features/teams/team-settings/team-settings.component.spec.ts`

- [ ] **Step 1: Add focused verification for the team-settings load split**

Before switching any UI surface to the new callable in an environment with legacy user docs, run the backfill utility and confirm it reports zero missing `teamId` docs on a dry run.

If `src/app/features/teams/team-settings/team-settings.component.spec.ts` does not exist yet, create a minimal focused spec that verifies the refactored load contract:

- current members are loaded from a targeted member lookup, not from the candidate list
- membership candidates are loaded from the new candidate API
- load failure still leaves the component in a non-loading state

Keep this spec narrow; do not scaffold broad UI interaction coverage.

- [ ] **Step 2: Replace full-directory loads with targeted member and candidate loads**

Update each surface to:

- stop calling `getDirectoryUsers()` for candidate selection
- call `getMembershipCandidates(teamId)` once on load/open
- keep local search/filter behavior over the returned safe candidate list
- preserve current error/loading handling

Be explicit per surface:

- `add-member-dialog.component.ts`
  - replace `allUsers` state with `TeamMembershipCandidate[]`
  - keep `selectedUser` and local search state aligned with the new DTO
- `manage-team-dialog.component.ts`
  - keep `members` as the existing full member list from `teamService.getTeamMembers(...)`
  - replace candidate state with `TeamMembershipCandidate[]`
- `team-settings.component.ts`
  - stop deriving `members` from the former `allUsers` full-directory load
  - load current members through `teamService.getTeamMembers(teamId)`
  - hold candidate state separately as `TeamMembershipCandidate[]`
  - do not reuse `AppUser[]` candidate state for the new backend payload

This split is required so removing the broad directory read does not break existing member display.

- [ ] **Step 3: Verify compile-time and runtime contract fit**

Run:

```bash
npm run test -- --watch=false --browsers=ChromeHeadless --include=src/app/features/teams/team-settings/team-settings.component.spec.ts
npm run build
```

Expected:
- focused team-settings spec PASS
- PASS, with only the pre-existing bundle budget warning allowed

- [ ] **Step 4: Commit the UI migration**

```bash
git add src/app/features/teams/add-member-dialog/add-member-dialog.component.ts src/app/features/teams/manage-team-dialog/manage-team-dialog.component.ts src/app/features/teams/team-settings/team-settings.component.ts src/app/features/teams/team-settings/team-settings.component.spec.ts
git commit -m "refactor: use server-backed membership candidates"
```

---

### Task 4: Sync Roadmap And Inventory

**Files:**
- Modify: `docs/security-access-inventory.md`
- Modify: `docs/production-readiness-roadmap.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: Update the inventory**

Record that:

- add/manage/team-settings candidate pickers no longer require `getDocs(collection(db, 'users'))`
- the remaining `users` profile-visibility seam is explicit and documented, not hidden behind browser candidate flows

- [ ] **Step 2: Update the roadmap**

Update `docs/production-readiness-roadmap.md` so `PR-002` reflects:

- `teams` reads already narrowed
- candidate picker broad `users` reads removed
- any future `users/{uid}` narrowing is a separate product decision, not part of this rollout

- [ ] **Step 3: Update durable repo guidance if needed**

If the candidate-search boundary is now the intended stable pattern, add one concise rule to `AGENTS.md` so future agents do not reintroduce full-directory member pickers.

- [ ] **Step 4: Run final verification for this rollout**

Run:

```bash
node --test functions/team/getMembershipCandidates.test.js
npm run test -- --watch=false --browsers=ChromeHeadless --include=src/app/core/services/team-directory.service.spec.ts
npm run build
```

Expected:
- backend tests PASS
- focused frontend tests PASS
- build PASS

- [ ] **Step 5: Commit docs/status sync**

```bash
git add docs/security-access-inventory.md docs/production-readiness-roadmap.md AGENTS.md
git commit -m "docs: sync candidate search rollout status"
```
