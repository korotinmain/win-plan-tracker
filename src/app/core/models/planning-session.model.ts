import { Timestamp } from '@firebase/firestore';

// ---------------------------------------------------------------------------
// Phase & outcome vocabulary
// ---------------------------------------------------------------------------

/** The seven sequential phases of a v2 sprint planning session. */
export type PlanningPhase =
  | 'setup'
  | 'readiness'
  | 'context'
  | 'review'
  | 'balancing'
  | 'final-review'
  | 'finalized';

/** Explicit planning decision for a single sprint candidate issue. */
export type IssueOutcome =
  | 'confirmed'
  | 'reassigned'
  | 'risky-accepted'
  | 'needs-clarification'
  | 'deferred'
  | 'split-candidate';

// ---------------------------------------------------------------------------
// Issue review
// ---------------------------------------------------------------------------

/**
 * Represents the planning decision for a single sprint candidate issue.
 * One entry per issue in the order the facilitator will review them.
 */
export interface IssueReview {
  issueId: string;
  issueKey: string;
  title: string;
  /** Official story point value read from Jira at session creation time. */
  storyPoints: number;
  /**
   * Story point value agreed during the WinPlan planning session.
   * Null means the facilitator has not set a planning-specific value.
   * Planning calculations prefer this over `storyPoints` when set.
   */
  plannedStoryPoints?: number | null;
  assignee: string | null;
  type: string;
  priority: string;
  status: string;
  statusCategory: string;
  /** Facilitator-set planning decision. Null until the issue has been reviewed. */
  outcome: IssueOutcome | null;
  /** Optional notes captured during discussion, written by the facilitator. */
  notes: string;
  /** True when the issue carries over from the current / active sprint. */
  isCarryover: boolean;
  /** True when storyPoints >= 13; surfaces as a readiness warning. */
  isSuspiciouslyLarge: boolean;
  hasNoEstimate: boolean;
  hasNoAssignee: boolean;
  reviewedAt: Timestamp | null;
  reviewedBy: string | null;
}

// ---------------------------------------------------------------------------
// Capacity
// ---------------------------------------------------------------------------

/** Per-person workload versus available capacity for the sprint. */
export interface CapacityEntry {
  uid: string;
  name: string;
  /** SP total for issues with outcome 'confirmed' or 'risky-accepted'. */
  plannedSP: number;
  /**
   * Available capacity in SP for the sprint.
   * Derived from sprint working days × team velocity factor, minus absences.
   * Remains 0 when not computable.
   */
  availableSP: number;
  isOverloaded: boolean;
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

/** Aggregate counts and SP totals for a finalized or in-progress session. */
export interface PlanningSessionSummary {
  confirmedCount: number;
  deferredCount: number;
  riskyCount: number;
  unclearCount: number;
  splitCandidateCount: number;
  totalIssues: number;
  totalSP: number;
  /** SP for issues with outcome 'confirmed' or 'risky-accepted'. */
  committedSP: number;
}

// ---------------------------------------------------------------------------
// Session V2 document
// ---------------------------------------------------------------------------

/**
 * Sprint planning session — schema version 2.
 *
 * Replaces the legacy v1 PlanningSession shape used by the old
 * sprint-planning component. Use `isPlanningSessionV2()` to distinguish
 * at runtime.
 */
export interface PlanningSessionV2 {
  id?: string;
  /** Discriminator field. Always 2 for v2 sessions. */
  schemaVersion: 2;

  sprintId: string | number;
  sprintName: string;
  sprintGoal: string | null;
  sprintStartDate: string | null;
  sprintEndDate: string | null;

  teamId: string;
  status: 'draft' | 'completed' | 'cancelled';

  /** Current workflow phase. Advanced only by the facilitator. */
  phase: PlanningPhase;

  /**
   * Index into `issueReviews` for the issue currently under review.
   * The facilitator is the only person who may advance this value.
   * All participants observe it via the live Firestore listener.
   */
  currentReviewIndex: number;

  facilitatorId: string;
  facilitatorName: string;

  participantIds: string[];
  participantNames: string[];

  /** One entry per sprint candidate, in review order. */
  issueReviews: IssueReview[];

  /**
   * Maps issueId → array of participant UIDs who have indicated they have
   * reviewed / weighed-in on this issue.
   *
   * Stored as a top-level Firestore map so individual entries can be updated
   * atomically via `arrayUnion` without rewriting the entire `issueReviews`
   * array. Example: `{ "PROJ-42": ["uid1", "uid2"] }`
   */
  issueParticipation: Record<string, string[]>;

  /** Readiness warnings computed in Phase 2; preserved in snapshot. */
  readinessWarnings: string[];

  /** Per-person capacity snapshot, populated during Phase 5. */
  capacityData: CapacityEntry[];

  summary: PlanningSessionSummary;

  createdBy: string;
  createdByName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  completedAt?: Timestamp;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the effective story point value for planning calculations.
 * Prefers the planning-session value (`plannedStoryPoints`) over the Jira
 * value (`storyPoints`). Falls back gracefully for legacy sessions that
 * only have the `storyPoints` field.
 */
export function effectiveSP(r: IssueReview): number {
  return r.plannedStoryPoints ?? r.storyPoints ?? 0;
}

/** Type guard — distinguishes v2 sessions from the legacy v1 shape. */
export function isPlanningSessionV2(
  session: { schemaVersion?: unknown },
): session is PlanningSessionV2 {
  return session.schemaVersion === 2;
}

/**
 * Derives a fresh `PlanningSessionSummary` from an `IssueReview` array.
 * Stateless — safe to call anywhere without side effects.
 */
export function computeSessionSummary(
  reviews: IssueReview[],
): PlanningSessionSummary {
  let confirmedCount = 0;
  let deferredCount = 0;
  let riskyCount = 0;
  let unclearCount = 0;
  let splitCandidateCount = 0;
  let committedSP = 0;

  for (const r of reviews) {
    switch (r.outcome) {
      case 'confirmed':
        confirmedCount++;
        committedSP += effectiveSP(r);
        break;
      case 'risky-accepted':
        riskyCount++;
        committedSP += effectiveSP(r);
        break;
      case 'deferred':
        deferredCount++;
        break;
      case 'needs-clarification':
        unclearCount++;
        break;
      case 'split-candidate':
        splitCandidateCount++;
        break;
    }
  }

  return {
    confirmedCount,
    deferredCount,
    riskyCount,
    unclearCount,
    splitCandidateCount,
    totalIssues: reviews.length,
    totalSP: reviews.reduce((sum, r) => sum + effectiveSP(r), 0),
    committedSP,
  };
}

// ---------------------------------------------------------------------------
// Creation payload
// ---------------------------------------------------------------------------

/**
 * Input required to create a new v2 planning session.
 * The service layer derives facilitator identity from `AuthService.currentUser`.
 */
export interface CreateSessionV2Payload {
  sprintId: string | number;
  sprintName: string;
  sprintGoal: string | null;
  sprintStartDate: string | null;
  sprintEndDate: string | null;
  participantIds: string[];
  participantNames: string[];
  issueReviews: IssueReview[];
}
