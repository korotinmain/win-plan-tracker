# PR-002 Users Read Contract Closure Implementation Plan

> Status: Closed on 2026-03-23. This plan was executed: emulator verification landed, rules/comments/docs were aligned, and PR-002 now tracks as a closed intentional-contract decision rather than an open rules-tightening task.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close PR-002 by explicitly validating and documenting that broad authenticated `users/{uid}` profile reads are an intentional product contract, while member-management candidate discovery stays on the narrower backend callable path.

**Architecture:** Do not tighten `users/{uid}` rules in this plan. Instead, add one committed Firestore emulator verification script for the intended contract, make the rules/comments/docs say the same thing, and update roadmap status so PR-002 is no longer tracked as an unresolved security mismatch.

**Tech Stack:** Firebase Firestore rules, Firebase emulator CLI, Node 20 CommonJS verification script, Angular 18 documentation and repo guidance

---

## File Structure

### Existing Files To Modify

- `firestore.rules`
  - clarify that broad authenticated profile reads are intentional, while `teams` reads remain scoped and member pickers should not depend on broad browser directory scans
- `docs/production-readiness-roadmap.md`
  - update PR-002 from "broad read mismatch" to "intentional verified contract"
- `docs/security-access-inventory.md`
  - mark the remaining broad `users` seam as intentional product visibility rather than an unresolved blocker
- `AGENTS.md`
  - encode the durable rule that broad `users` reads are intentional, but team member pickers must still use `TeamDirectoryService.getMembershipCandidates(...)`
- `docs/superpowers/specs/2026-03-23-pr-002-server-backed-candidate-search-design.md`
  - mark the candidate-search spec as landed/superseded by the explicit users-read contract decision
- `docs/superpowers/plans/2026-03-23-phase-1-pr-002-candidate-search-rollout.md`
  - mark the earlier rollout plan as completed and note that PR-002 closure now happens through contract verification, not rules tightening
- `docs/superpowers/plans/2026-03-22-phase-1-pr-002-directory-contract-hardening.md`
  - add a concise superseded/closed note so it no longer frames PR-002 as open hardening work
- `docs/superpowers/plans/2026-03-22-phase-1-pr-011-membership-write-authority.md`
  - add a concise cross-reference note where it still points at PR-002 as pending
- `docs/superpowers/plans/2026-03-21-phase-1-security-access-contracts.md`
  - add a concise checkpoint note where Phase 1 still says PR-002 remains open

### New Files To Create

- `scripts/firestore/verify-pr002-users-read-contract.cjs`
  - committed emulator-backed verification for the intended `users`/`teams` read contract

### Boundaries

- Do not tighten `users/{uid}` Firestore rules in this plan.
- Do not remove `TeamDirectoryService.getDirectoryUsers()` or `TeamService.getAllUsers()` yet.
- Do not change frontend feature behavior in `src/` during this closure pass.
- Do not touch `updateTeamMembership` or `getTeamMembershipCandidates` behavior.

---

### Task 1: Add Emulator Verification For The Intended Read Contract

**Files:**
- Create: `scripts/firestore/verify-pr002-users-read-contract.cjs`

- [ ] **Step 1: Write the verification script skeleton**

Create `scripts/firestore/verify-pr002-users-read-contract.cjs` with emulator assertions for:

```js
// intended contract
// 1. signed-in user can read another user's profile doc
// 2. signed-in user can query users collection
// 3. existing team member can read their own team
// 4. joined user cannot read an unrelated team
// 5. no-team user can query teams for join/discovery
// 6. elevated role can still read teams broadly
// auth boundary
// 7. signed-out user cannot read another user's profile doc
// 8. signed-out user cannot read teams collection
```

Use only a rules-enforced emulator harness:

- authenticated client contexts or rules-unit-testing helpers are allowed
- Admin SDK bypass reads are not allowed for the assertions themselves
- the script must fail if a rules check unexpectedly allows or denies

- [ ] **Step 2: Run the emulator verification once**

Run:

```bash
firebase emulators:exec --only firestore,auth --project phase1-rules-check "node scripts/firestore/verify-pr002-users-read-contract.cjs"
```

Expected:
- PASS for all intended allow/deny checks

- [ ] **Step 3: Commit the verification script**

```bash
git add scripts/firestore/verify-pr002-users-read-contract.cjs
git commit -m "test: verify intentional users read contract"
```

---

### Task 2: Align Rules Comments With The Actual Product Contract

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 1: Update the `users` and `teams` comments only**

Adjust comments so they say the same thing the product now intends:

- `users/{uid}` broad authenticated profile reads are intentional
- `teams/{teamId}` reads are still scoped to membership, no-team discovery, and elevated roles
- member-management candidate pickers should use the backend candidate-search path instead of relying on broad browser reads

Do not change rule expressions in this step unless a comment reveals an actual mismatch that must be fixed.

- [ ] **Step 2: Re-run the emulator verification**

Run:

```bash
firebase emulators:exec --only firestore,auth --project phase1-rules-check "node scripts/firestore/verify-pr002-users-read-contract.cjs"
```

Expected:
- PASS

- [ ] **Step 3: Commit the rules-comment sync**

```bash
git add firestore.rules
git commit -m "docs: clarify users read contract in rules"
```

---

### Task 3: Close PR-002 In Roadmap And Inventory

**Files:**
- Modify: `docs/production-readiness-roadmap.md`
- Modify: `docs/security-access-inventory.md`
- Modify: `AGENTS.md`
- Modify: `docs/superpowers/specs/2026-03-23-pr-002-server-backed-candidate-search-design.md`
- Modify: `docs/superpowers/plans/2026-03-23-phase-1-pr-002-candidate-search-rollout.md`
- Modify: `docs/superpowers/plans/2026-03-22-phase-1-pr-002-directory-contract-hardening.md`
- Modify: `docs/superpowers/plans/2026-03-22-phase-1-pr-011-membership-write-authority.md`
- Modify: `docs/superpowers/plans/2026-03-21-phase-1-security-access-contracts.md`

- [ ] **Step 1: Update the roadmap**

In `docs/production-readiness-roadmap.md`:

- mark `PR-002` as `done`
- rewrite the finding summary so it reflects an intentional verified contract:
  - broad signed-in `users` profile reads are deliberate
  - `teams` reads remain narrowed
  - member-management candidate discovery no longer depends on broad browser `users` scans
- update all PR-002 narrative sections, not only the status line:
  - `Current Risk`
  - `Recommended Direction`
  - `Current Phase 1 Progress`
  - `Validation`
- update Phase 1 notes and immediate next steps so the next major work moves to Phase 2 decomposition instead of more `PR-002` hardening
- update any `Open Questions / Blockers` wording that still frames `users/{uid}` tightening as pending work

- [ ] **Step 2: Update the security inventory**

In `docs/security-access-inventory.md`:

- keep the explicit `getDirectoryUsers()` seam listed
- mark it as intentional profile visibility rather than an unresolved security blocker
- keep `TeamService.getAllUsers()` listed, but reclassify it explicitly as an intentional temporary compatibility shim over the same broad profile-visibility contract
- keep the backend candidate-search row as the required boundary for member-management pickers
- remove or rewrite any note that still says the remaining `users` hardening is pending after PR-002 closes
- note that future tightening would require a new product decision, not just a rules tweak

- [ ] **Step 3: Update durable repo guidance**

In `AGENTS.md` add or adjust concise guidance so future agents know:

- broad authenticated profile reads in `users` are currently intentional
- this does **not** justify reintroducing broad browser member-pickers
- `TeamDirectoryService.getMembershipCandidates(...)` remains the required path for team member candidate discovery

- [ ] **Step 4: Update companion PR-002 docs**

In the earlier candidate-search companion docs:

- add one concise note in `docs/superpowers/specs/2026-03-23-pr-002-server-backed-candidate-search-design.md` that the candidate-search design landed and that PR-002 closure now follows the explicit product decision to keep broad authenticated profile reads intentional
- add one concise note in `docs/superpowers/plans/2026-03-23-phase-1-pr-002-candidate-search-rollout.md` that the rollout is complete and no further `users/{uid}` tightening is part of PR-002 unless product requirements change
- add concise superseded/checkpoint notes in the older Phase 1 plan docs that still describe PR-002 as pending, so historical documents remain readable without contradicting the closed roadmap state

- [ ] **Step 5: Commit the documentation/status sync**

```bash
git add docs/production-readiness-roadmap.md docs/security-access-inventory.md AGENTS.md docs/superpowers/specs/2026-03-23-pr-002-server-backed-candidate-search-design.md docs/superpowers/plans/2026-03-23-phase-1-pr-002-candidate-search-rollout.md docs/superpowers/plans/2026-03-22-phase-1-pr-002-directory-contract-hardening.md docs/superpowers/plans/2026-03-22-phase-1-pr-011-membership-write-authority.md docs/superpowers/plans/2026-03-21-phase-1-security-access-contracts.md
git commit -m "docs: close pr-002 users read contract"
```

---

### Task 4: Final Verification And Phase Checkpoint

**Files:**
- Verify only; no new files required

- [ ] **Step 1: Run the final focused verification set**

Run:

```bash
firebase emulators:exec --only firestore,auth --project phase1-rules-check "node scripts/firestore/verify-pr002-users-read-contract.cjs"
node --test functions/team/getMembershipCandidates.test.js functions/team/backfillMissingUserTeamIds.test.js
npm run test -- --watch=false --browsers=ChromeHeadless --include=src/app/core/services/team-directory.service.spec.ts
npm run test -- --watch=false --browsers=ChromeHeadless --include=src/app/features/teams/team-settings/team-settings.component.spec.ts
npm run build
```

Expected:
- emulator verification PASS
- backend candidate/backfill tests PASS
- focused service spec PASS
- focused team-settings spec PASS
- build PASS, with only the pre-existing initial bundle budget warning allowed

- [ ] **Step 2: Record the checkpoint**

Capture in the final summary:

- exact emulator assertions that passed
- whether PR-002 is now fully closed
- remaining Phase 1 local noise files, if any
- next recommended track (Phase 2 decomposition)

- [ ] **Step 3: Commit any final tiny verification-driven fixes if needed**

If final verification exposed a real mismatch, fix only that mismatch and commit it separately with a narrow message.
