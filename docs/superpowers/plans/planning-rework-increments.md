# Sprint Planning Rework — Increment Tracker

**Goal:** Replace the legacy monolithic sprint-planning component with a phase-driven,
real-time collaborative planning session backed by a clean v2 data model.

---

## Increment Summary

| # | Title | Status | Date |
|---|-------|--------|------|
| 1 | Foundation: Models & Service Layer | ✅ Done | 2026-03-23 |
| 2 | Shell + Phase Navigator + Setup Phase | 🔜 Next | — |
| 3 | Readiness + Context Phases | 🔜 Planned | — |
| 4 | Issue-by-Issue Review Phase | 🔜 Planned | — |
| 5 | Workload Balancing Phase | 🔜 Planned | — |
| 6 | Final Review + Finalization + Cleanup | 🔜 Planned | — |

---

## Increment 1 — Foundation: Models & Service Layer

**Status:** ✅ Done  
**Date:** 2026-03-23

### What changed

#### New file — `src/app/core/models/planning-session.model.ts`

All v2 typed interfaces, enums, and helper utilities:

| Export | Kind | Purpose |
|--------|------|---------|
| `PlanningPhase` | type | 7-phase workflow: `setup → readiness → context → review → balancing → final-review → finalized` |
| `IssueOutcome` | type | 6 planning decisions: `confirmed`, `reassigned`, `risky-accepted`, `needs-clarification`, `deferred`, `split-candidate` |
| `IssueReview` | interface | Per-issue data: outcome, notes, readiness flags, reviewed-by metadata |
| `CapacityEntry` | interface | Per-person SP load vs. available capacity for balancing phase |
| `PlanningSessionSummary` | interface | Aggregate counts and SP totals |
| `PlanningSessionV2` | interface | Full v2 session document shape stored in Firestore |
| `isPlanningSessionV2()` | function | Type guard — discriminates v2 from legacy v1 sessions via `schemaVersion === 2` |
| `computeSessionSummary()` | function | Stateless, derives `PlanningSessionSummary` from an `IssueReview[]` |
| `CreateSessionV2Payload` | interface | Input shape for `PlanningService.createSessionV2()` |

Key design decision: `issueParticipation: Record<string, string[]>` is stored as a top-level
Firestore map (not nested in `issueReviews`) so participant weigh-in can be written atomically
via `arrayUnion` without rewriting the entire `issueReviews` array.

#### Modified — `src/app/core/services/planning.service.ts`

All existing v1 methods are **unchanged** (backward compatible). Added new v2 section:

| New method | Description |
|------------|-------------|
| `liveSessionV2$(id)` | Real-time Observable via `docObservable`; all session participants subscribe to see phase/index changes |
| `createSessionV2(payload)` | Creates new v2 session doc in Firestore; derives facilitator identity from `AuthService.currentUser` |
| `getSessionV2ById(id)` | One-time fetch with v2 type guard |
| `advancePhase(id, phase, extra?)` | Facilitator-only: moves to next phase, optionally merging extra fields atomically |
| `setReviewIndex(id, index)` | Facilitator-only: updates `currentReviewIndex` |
| `updateIssueReviews(id, reviews)` | Persists full `issueReviews` array + recomputes summary |
| `markParticipantWeighed(id, issueId, uid)` | Participant: atomic `arrayUnion` into `issueParticipation[issueId]` |
| `updateCapacityAndSummary(id, capacity, summary)` | Persists balancing phase output |
| `finalizeSessionV2(id, reviews, capacity)` | Terminal write: sets `status='completed'`, `phase='finalized'`, `completedAt` |

New imports added: `arrayUnion` (Firestore), `Observable` (RxJS), `docObservable` (shared util), all model types from the new model file.

### Why

The legacy v1 schema (`workflowStep`, `tasks[]`, `guidedModeEnabled`) does not support the
7-phase workflow, explicit issue outcomes, real-time collaboration, or the participation model
required by the updated requirements. Rather than mutate the v1 schema (risk of breaking the
old component before the new one is ready), v2 is a clean parallel schema that will take over
when the new component is wired up in Increment 2.

### Risks & follow-ups

- Firestore rules already allow all team members to update sessions — no rule changes needed.
  The facilitator-only invariants (`advancePhase`, `setReviewIndex`) are enforced at the
  application layer only. This is acceptable for MVP; a production hardening would add
  Firestore rule checks via a `facilitatorId == request.auth.uid` condition.
- `markParticipantWeighed` uses `arrayUnion` with a dot-notation path
  (`issueParticipation.${issueId}`). This is supported by Firestore for top-level map fields.
- Old sessions remain fully readable and all existing UI (JiraComponent history, etc.) is
  unaffected.

### Validation

- `npm run build` executed — zero TypeScript errors, zero template errors.
- `firestore.rules` verified: existing `planningSessions` update rule allows any team member
  to write; no rule change required for Increment 1.

---

## Increment 2 — Shell + Phase Navigator + Setup Phase

**Status:** 🔜 Awaiting review approval

### Planned changes

- Create `src/app/features/sprints/planning-session/planning-session.component.{ts,html,scss}`
  — shell that owns session lifecycle, live Firestore listener, and phase state machine
- Create `phases/phase-setup/` — sprint confirmation card + participant selection
- Create `shared/phase-header/` — 7-step progress bar (locked/active/done states)
- Update `src/app/app.routes.ts`:
  - `/sprints/planning` → `PlanningSessionComponent` (state-based entry)
  - `/sprints/planning/:sessionId` → same component (bookmarkable, reloads by ID)
- Old `src/app/features/sprints/sprint-planning/` kept on disk, route-orphaned

---

## Increment 3 — Readiness + Context Phases

**Status:** 🔜 Planned

### Planned changes

- Create `phases/phase-readiness/` — evaluate issues for missing estimates, no assignee,
  carryover, suspiciously large SP; render warning list by severity
- Create `phases/phase-context/` — sprint name/dates/goal, previous velocity, team capacity,
  absence summary
- Create `shared/readiness-badge/` — compact severity chip

---

## Increment 4 — Issue-by-Issue Review Phase

**Status:** 🔜 Planned

### Planned changes

- Create `phases/phase-review/` with indexed navigation (`currentReviewIndex`)
- Create `shared/issue-card/` — title, type, priority, assignee, SP, status badge
- Create `shared/outcome-selector/` — 6 outcome buttons (facilitator-only writes)
- Create `shared/participation-panel/` — avatar stack showing who has weighed in;
  each participant can mark "I've reviewed" (calls `markParticipantWeighed`)
- Notes field per issue

---

## Increment 5 — Workload Balancing Phase

**Status:** 🔜 Planned

### Planned changes

- Create `phases/phase-balancing/` with SP-per-person horizontal bar chart
- Show confirmed vs. risky vs. remaining breakdown per person
- Show unassigned issues
- Inline outcome adjustment before committing

---

## Increment 6 — Final Review, Finalization & Cleanup

**Status:** 🔜 Planned

### Planned changes

- Create `phases/phase-final-review/` — committed/deferred/risky summary; "Commit to sprint" action
- Create `phases/phase-finalized/` — read-only committed session view
- Calls `finalizeSessionV2()` on commit; navigates back to `/sprints`
- Update `JiraComponent` history panel for v2 session display
- **Delete** `src/app/features/sprints/sprint-planning/` (old 1100-line component)
