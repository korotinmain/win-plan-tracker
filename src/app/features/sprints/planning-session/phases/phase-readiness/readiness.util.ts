import { IssueReview } from '../../../../../core/models/planning-session.model';
import { ReadinessSeverity } from '../../shared/readiness-badge/readiness-badge.component';

export interface ReadinessWarning {
  id: string;
  severity: ReadinessSeverity;
  title: string;
  detail: string;
  icon: string;
  /** Issue IDs this warning is about, empty = session-level */
  affectedIssueIds: string[];
}

/**
 * Derives the full list of readiness warnings from the issue review list.
 * Stateless pure function — safe to run in tests without Angular.
 */
export function computeReadinessWarnings(
  reviews: IssueReview[],
): ReadinessWarning[] {
  const warnings: ReadinessWarning[] = [];

  // Missing estimates
  const noEstimate = reviews.filter((r) => r.hasNoEstimate);
  if (noEstimate.length) {
    warnings.push({
      id: 'no-estimate',
      severity: 'warning',
      title: `${noEstimate.length} issue${noEstimate.length !== 1 ? 's' : ''} missing story points`,
      detail:
        'Unestimated issues make capacity planning unreliable. Ask the team to estimate before the session or mark them for clarification.',
      icon: 'data_usage',
      affectedIssueIds: noEstimate.map((r) => r.issueId),
    });
  }

  // Unassigned issues
  const noOwner = reviews.filter((r) => r.hasNoAssignee);
  if (noOwner.length) {
    warnings.push({
      id: 'no-owner',
      severity: 'info',
      title: `${noOwner.length} unassigned issue${noOwner.length !== 1 ? 's' : ''}`,
      detail:
        'Ownership should be resolved during the review phase. These issues will need an assignee before the sprint begins.',
      icon: 'person_off',
      affectedIssueIds: noOwner.map((r) => r.issueId),
    });
  }

  // Suspiciously large
  const large = reviews.filter((r) => r.isSuspiciouslyLarge);
  if (large.length) {
    warnings.push({
      id: 'large-issues',
      severity: 'warning',
      title: `${large.length} large issue${large.length !== 1 ? 's' : ''} (≥ 13 SP)`,
      detail:
        'Very large issues are risky. Consider splitting them before committing to the sprint.',
      icon: 'open_in_full',
      affectedIssueIds: large.map((r) => r.issueId),
    });
  }

  // Carryover from previous sprint
  const carryover = reviews.filter((r) => r.isCarryover);
  if (carryover.length) {
    warnings.push({
      id: 'carryover',
      severity: 'critical',
      title: `${carryover.length} carryover issue${carryover.length !== 1 ? 's' : ''} from current sprint`,
      detail:
        'Unfinished work from the active sprint is being planned again. Discuss whether these should take priority.',
      icon: 'replay',
      affectedIssueIds: carryover.map((r) => r.issueId),
    });
  }

  return warnings;
}

/** Returns true when none of the warnings are critical or warning severity. */
export function isReadinessClean(warnings: ReadinessWarning[]): boolean {
  return warnings.every((w) => w.severity === 'info');
}
