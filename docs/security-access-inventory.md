# Security Access Inventory

This inventory captures the current broad authenticated reads of the top-level `users` and `teams` collections. The objective for Phase 1 Task 4 is to make those reads explicit and isolated, not to tighten Firestore rules yet.

## Broad Collection Read Surface

| Feature / flow | File(s) | Current query shape | Required vs incidental | Candidate narrowing strategy |
| --- | --- | --- | --- | --- |
| Explicit user directory seam | `src/app/core/services/team-directory.service.ts` | `getDocs(collection(db, 'users'))` | Required today. This is now the explicit broad-read seam for user-directory style flows. | Replace with narrower user lookups per flow, for example `where('uid', 'in', ...)`, invited-member search, or team-scoped user indexes once contracts/rules are ready. |
| Explicit team directory seam | `src/app/core/services/team-directory.service.ts` | `snapObservable<Team>(query(collection(db, 'teams')))` | Required today. This is now the explicit broad-read seam for team-directory style flows. | Split join/discovery flows onto a narrower listing surface, such as public/joinable team docs or membership-scoped queries. |
| Compatibility surface: `TeamService.getAllUsers()` | `src/app/core/services/team.service.ts` | Delegates to `TeamDirectoryService.getDirectoryUsers()` | Incidental. Kept only for compatibility while callers migrate to explicit naming. | Remove after remaining callers move to the directory service or narrower query helpers. |
| Compatibility surface: `TeamService.getAllTeams()` | `src/app/core/services/team.service.ts` | Delegates to `TeamDirectoryService.getDirectoryTeams()` | Incidental. Kept only for compatibility while callers migrate to explicit naming. | Remove after remaining callers move to the directory service or a narrowed team-discovery API. |
| Add-member dialog candidate picker | `src/app/features/teams/add-member-dialog/add-member-dialog.component.ts` | Loads full user directory through `getDirectoryUsers()`, then filters out `currentMemberIds` client-side | Required today. The dialog needs a searchable candidate list, but the full read is broader than the eventual least-privilege target. | Add a server-backed candidate search or team-invite flow that only returns join-eligible users for the active team. |
| Manage-team dialog candidate picker | `src/app/features/teams/manage-team-dialog/manage-team-dialog.component.ts` | Loads full user directory through `getDirectoryUsers()`, then filters out `team.memberIds` client-side | Required today. Same dependency as add-member, with client-side filtering. | Reuse the same narrowed candidate source as add-member so management UI does not depend on the whole `users` collection. |
| Join-team flow in teams workspace | `src/app/features/teams/teams/teams.component.ts` | Subscribes to full team directory via `TeamService.getAllTeams()` and filters client-side by membership/search | Required today for the current browse-and-join UX. | Introduce a joinable-team listing surface with explicit visibility rules instead of all signed-in users seeing every team doc. |
| Join-team flow in settings workspace | `src/app/features/settings/settings/settings.component.ts` | Subscribes to full team directory via `TeamService.getAllTeams()` and filters client-side by membership | Required today for the current settings-based team join/leave flow. | Reuse the same narrowed joinable-team source as the teams workspace so both flows share one explicit contract. |
| Team settings member management | `src/app/features/teams/team-settings/team-settings.component.ts` | Loads full user directory via `TeamService.getAllUsers()` and derives members/candidates client-side | Required today, but broad for the same reason as add-member/manage-team. | Migrate to `TeamDirectoryService` first, then move to a narrowed team-candidate/member query once the contract exists. |

## Notes

- Current Firestore rules still allow signed-in reads of `users/{uid}` and `teams/{teamId}` broadly; this task does not change those rules.
- Code search in the current worktree found the only full-collection reads at the data-access layer in the directory seam and the temporary `TeamService` compatibility methods. The remaining entries above are feature-level callers that depend on those reads.
- `TeamService.getTeamsForUser(...)`, `getMembersByIds(...)`, and per-document `getTeam(...)` / `getTeamMembers(...)` are not counted as broad reads here because they already use narrower queries or direct document reads.
