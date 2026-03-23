# Phase 1 PR-011 Membership Write Authority Implementation Plan

> Status: Superseded. Phase 1 did not widen `users/{uid}` write rules. PR-011 closed instead through the privileged `updateTeamMembership` callable, which moved cross-user membership mutations to the backend.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align `users/{uid}` write rules with the current team-membership flows so Phase 1 no longer depends on a known rules mismatch before `users` read hardening.

**Architecture:** Keep the fix narrow. Do not redesign team membership flows or tighten `users` reads yet. Instead, explicitly authorize the existing cross-user `teamId` write paths that are already part of add-member and remove-member flows, then prove those writes and denials in the emulator. This preserves current UX while turning the current mismatch into a checked-in contract.

**Tech Stack:** Angular 18, Firebase Firestore, Firestore rules, Firebase Auth emulator, Jasmine/Karma

---

## File Structure

### Existing Files To Modify

- `firestore.rules`
  - add explicit helpers/rules for manager/admin-controlled membership writes to `users/{uid}`
- `docs/production-readiness-roadmap.md`
  - move PR-011 from implicit blocker to explicit implemented contract if verification passes
- `docs/security-access-inventory.md`
  - record that `users` broad reads remain open, but membership writes are no longer blocked by a rules mismatch
- `AGENTS.md`
  - keep repo-level contract notes aligned with the checked-in rules if the write model changes

### Local-Only Verification Artifacts

- `.firebase.phase1.rules.json`
  - existing emulator config in the worktree
- `/tmp/phase1-user-write-check.cjs`
  - local-only rules harness for allowed and denied membership writes

## Task 1: Authorize Existing Membership Write Paths

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 1: Write the failing emulator verification harness**

Create `/tmp/phase1-user-write-check.cjs` to verify:

- self-write to own `users/{uid}` still succeeds
- admin/manager of a team can set another user’s `teamId` to that team
- admin/manager of a team can clear another user’s `teamId` when removing them
- unrelated non-elevated user cannot set another user’s `teamId`
- unrelated non-elevated user cannot clear another user’s `teamId`

- [ ] **Step 2: Run emulator verification to confirm RED**

Run:

```bash
firebase emulators:exec --config .firebase.phase1.rules.json --only firestore,auth --project phase1-rules-check "node /tmp/phase1-user-write-check.cjs"
```

Expected:
- FAIL on the cross-user membership write cases under the current self-write-only rule

- [ ] **Step 3: Implement the minimal rules contract**

Update `firestore.rules` so `match /users/{uid}` still allows self-writes, but also allows the existing membership-management writes:

- assign `teamId` to a user when the caller is authorized to manage that target team
- clear `teamId` from a user when the caller is authorized to manage the user’s current team

Keep the rule narrow:

- do not broaden arbitrary profile writes
- do not change `users` read visibility yet
- keep the authorization logic explicit in helper functions

- [ ] **Step 4: Re-run emulator verification to confirm GREEN**

Run:

```bash
firebase emulators:exec --config .firebase.phase1.rules.json --only firestore,auth --project phase1-rules-check "node /tmp/phase1-user-write-check.cjs"
```

Expected:
- self-write allow
- authorized membership assignment allow
- authorized membership removal allow
- unrelated cross-user writes denied

- [ ] **Step 5: Re-run compile verification**

Run:

```bash
npm run build
git diff --check
```

Expected:
- build PASS
- diff clean

- [ ] **Step 6: Commit**

```bash
git add firestore.rules
git commit -m "fix: align membership writes with firestore rules"
```

## Task 2: Sync The Documented Contract

**Files:**
- Modify: `docs/production-readiness-roadmap.md`
- Modify: `docs/security-access-inventory.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: Update roadmap**

Record:

- PR-011 is implemented if emulator verification passed
- broad signed-in `users/{uid}` reads remain intentional unless a later product decision narrows them
- team-membership writes now have an explicit rules contract

- [ ] **Step 2: Update inventory**

Record:

- broad `users` reads are still intentional for candidate-picking flows
- the prior cross-user membership write mismatch is no longer an open blocker if Task 1 passed

- [ ] **Step 3: Update AGENTS if needed**

Keep repository instructions aligned with the checked-in rules so future agents do not rely on stale access assumptions.

- [ ] **Step 4: Final verification**

Run:

```bash
npm run build
```

Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add docs/production-readiness-roadmap.md docs/security-access-inventory.md AGENTS.md
git commit -m "docs: record membership write contract"
```

## Acceptance Checklist

- [ ] Cross-user membership writes are no longer blocked by the self-write-only `users/{uid}` rule
- [ ] Self-write behavior for `users/{uid}` remains intact
- [ ] Unauthorized cross-user profile writes are still denied
- [ ] Emulator coverage exists for allowed and denied membership write paths
- [ ] Repo docs clearly explain the current `users` read contract instead of implying a stale PR-002 blocker
- [ ] Repo docs match the checked-in rule contract

## Notes For Execution

- Keep local-only emulator harness files untracked.
- Do not tighten `users` reads in this plan; that is the follow-up slice after the write authority model is explicit.
- If emulator verification shows that current UI flows require even broader cross-user profile writes, stop and document the exact mismatch instead of widening rules silently.
