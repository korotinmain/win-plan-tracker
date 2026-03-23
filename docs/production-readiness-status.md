# Production Readiness Status

Last updated: 2026-03-23

## Logical Stop Point

This repository is now paused after Phase 1 security and access hardening.

The current codebase is in a safer state than baseline, the new access contracts are verified, and the next major work should move to Phase 2 decomposition instead of more Phase 1 security work.

## What Is Done

- `planningSessions` are no longer open to every signed-in user.
- New planning sessions write `teamId` and `participantIds`.
- Legacy planning sessions still work through creator-only fallback.
- `teams` reads are narrowed to membership, no-team discovery, and elevated roles.
- Team membership authority moved to backend callables.
- Browser-side member pickers no longer read the full `users` collection.
- Team member-management now uses backend candidate search.
- Settings and teams screens no longer keep broad team-directory reads alive after a user already belongs to a team.
- Focused backend, frontend, Firestore-emulator, and build verification were added and passed at the Phase 1 checkpoint.
- `AGENTS.md` and roadmap docs were updated to reflect the checked-in contracts.

## What Changed In Runtime Code

- Firebase rules were tightened for `planningSessions` and `teams`.
- New Functions were added for:
  - `updateTeamMembership`
  - `getTeamMembershipCandidates`
  - legacy `users.teamId` backfill support
- New frontend seams were added:
  - `planning-session-access.util`
  - `TeamDirectoryService`
  - `docObservable(...)`
- Jira, sprint-planning, settings, teams, team-settings, add-member, and manage-team flows were updated to use the new scoped contracts.

## What Remains

The production-readiness roadmap still has these open findings:

- `PR-003`: decompose sprint planning surface
- `PR-004`: decompose calendar grid surface
- `PR-005`: decompose teams surface
- `PR-006`: fix presence lifecycle and teardown model
- `PR-007`: reduce weak typing and timestamp debt
- `PR-008`: reduce bundle size and clear the build budget warning
- `PR-009`: add meaningful automated coverage for critical logic
- `PR-010`: decompose dashboard surface

## Recommended Next Step

Start Phase 2 with sprint planning decomposition.

Reason:

- it is the largest concentrated architecture hotspot
- it is already carrying planning state, workflow logic, and heavy UI orchestration
- the design will be reworked later anyway, so this is the best place to simplify structure now

## Reference Docs

- `docs/production-readiness-roadmap.md`
- `docs/security-access-inventory.md`
- `AGENTS.md`
