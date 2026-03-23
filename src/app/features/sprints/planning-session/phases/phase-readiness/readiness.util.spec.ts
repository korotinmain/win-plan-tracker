import { IssueReview } from '../../../../../core/models/planning-session.model';
import {
  ReadinessWarning,
  computeReadinessWarnings,
  isReadinessClean,
} from './readiness.util';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeReview(overrides: Partial<IssueReview> = {}): IssueReview {
  return {
    issueId: 'PROJ-1',
    issueKey: 'PROJ-1',
    title: 'Test issue',
    storyPoints: 5,
    assignee: 'Alice',
    type: 'Story',
    priority: 'Medium',
    status: 'To Do',
    statusCategory: 'TODO',
    outcome: null,
    notes: '',
    isCarryover: false,
    isSuspiciouslyLarge: false,
    hasNoEstimate: false,
    hasNoAssignee: false,
    reviewedAt: null,
    reviewedBy: null,
    ...overrides,
  };
}

// ─── computeReadinessWarnings ────────────────────────────────────────────────

describe('computeReadinessWarnings', () => {
  it('returns empty array when input is empty', () => {
    expect(computeReadinessWarnings([])).toEqual([]);
  });

  it('returns empty array when all issues are clean', () => {
    const reviews = [makeReview(), makeReview({ issueId: 'PROJ-2' })];
    expect(computeReadinessWarnings(reviews)).toEqual([]);
  });

  describe('no-estimate warning', () => {
    it('emits a warning-severity warning when issues have no estimate', () => {
      const reviews = [makeReview({ issueId: 'PROJ-1', hasNoEstimate: true })];
      const warnings = computeReadinessWarnings(reviews);
      const w = warnings.find((x) => x.id === 'no-estimate');
      expect(w).toBeDefined();
      expect(w!.severity).toBe('warning');
    });

    it('includes affected issue IDs', () => {
      const reviews = [
        makeReview({ issueId: 'PROJ-1', hasNoEstimate: true }),
        makeReview({ issueId: 'PROJ-2', hasNoEstimate: true }),
        makeReview({ issueId: 'PROJ-3', hasNoEstimate: false }),
      ];
      const w = computeReadinessWarnings(reviews).find(
        (x) => x.id === 'no-estimate',
      )!;
      expect(w.affectedIssueIds).toEqual(['PROJ-1', 'PROJ-2']);
    });

    it('pluralises title correctly for one issue', () => {
      const reviews = [makeReview({ hasNoEstimate: true })];
      const w = computeReadinessWarnings(reviews).find(
        (x) => x.id === 'no-estimate',
      )!;
      expect(w.title).toContain('1 issue missing');
    });

    it('pluralises title correctly for multiple issues', () => {
      const reviews = [
        makeReview({ issueId: 'A', hasNoEstimate: true }),
        makeReview({ issueId: 'B', hasNoEstimate: true }),
      ];
      const w = computeReadinessWarnings(reviews).find(
        (x) => x.id === 'no-estimate',
      )!;
      expect(w.title).toContain('2 issues missing');
    });

    it('is omitted when no issues are unestimated', () => {
      const reviews = [makeReview({ hasNoEstimate: false })];
      const ids = computeReadinessWarnings(reviews).map((w) => w.id);
      expect(ids).not.toContain('no-estimate');
    });
  });

  describe('no-owner warning', () => {
    it('emits info-severity when issues are unassigned', () => {
      const reviews = [makeReview({ issueId: 'PROJ-1', hasNoAssignee: true })];
      const w = computeReadinessWarnings(reviews).find(
        (x) => x.id === 'no-owner',
      )!;
      expect(w).toBeDefined();
      expect(w.severity).toBe('info');
    });

    it('includes all unassigned issue IDs', () => {
      const reviews = [
        makeReview({ issueId: 'PROJ-1', hasNoAssignee: true }),
        makeReview({ issueId: 'PROJ-2', hasNoAssignee: false }),
      ];
      const w = computeReadinessWarnings(reviews).find(
        (x) => x.id === 'no-owner',
      )!;
      expect(w.affectedIssueIds).toEqual(['PROJ-1']);
    });

    it('is omitted when all issues have assignees', () => {
      const reviews = [makeReview({ hasNoAssignee: false })];
      expect(
        computeReadinessWarnings(reviews).find((x) => x.id === 'no-owner'),
      ).toBeUndefined();
    });
  });

  describe('large-issues warning', () => {
    it('emits warning-severity for suspiciously large issues', () => {
      const reviews = [
        makeReview({ issueId: 'PROJ-1', isSuspiciouslyLarge: true }),
      ];
      const w = computeReadinessWarnings(reviews).find(
        (x) => x.id === 'large-issues',
      )!;
      expect(w).toBeDefined();
      expect(w.severity).toBe('warning');
    });

    it('lists affected issue IDs', () => {
      const reviews = [
        makeReview({ issueId: 'BIG-1', isSuspiciouslyLarge: true }),
        makeReview({ issueId: 'BIG-2', isSuspiciouslyLarge: true }),
      ];
      const w = computeReadinessWarnings(reviews).find(
        (x) => x.id === 'large-issues',
      )!;
      expect(w.affectedIssueIds).toEqual(['BIG-1', 'BIG-2']);
    });

    it('is omitted when no large issues exist', () => {
      const reviews = [makeReview({ isSuspiciouslyLarge: false })];
      expect(
        computeReadinessWarnings(reviews).find((x) => x.id === 'large-issues'),
      ).toBeUndefined();
    });
  });

  describe('carryover warning', () => {
    it('emits critical severity for carryover issues', () => {
      const reviews = [makeReview({ issueId: 'CO-1', isCarryover: true })];
      const w = computeReadinessWarnings(reviews).find(
        (x) => x.id === 'carryover',
      )!;
      expect(w).toBeDefined();
      expect(w.severity).toBe('critical');
    });

    it('lists affected carryover issue IDs', () => {
      const reviews = [
        makeReview({ issueId: 'CO-1', isCarryover: true }),
        makeReview({ issueId: 'CO-2', isCarryover: true }),
        makeReview({ issueId: 'CLEAN', isCarryover: false }),
      ];
      const w = computeReadinessWarnings(reviews).find(
        (x) => x.id === 'carryover',
      )!;
      expect(w.affectedIssueIds).toEqual(['CO-1', 'CO-2']);
    });

    it('is omitted when no carryover issues exist', () => {
      const reviews = [makeReview({ isCarryover: false })];
      expect(
        computeReadinessWarnings(reviews).find((x) => x.id === 'carryover'),
      ).toBeUndefined();
    });
  });

  it('returns all four warning types when all conditions trigger', () => {
    const reviews = [
      makeReview({
        issueId: 'ALL',
        hasNoEstimate: true,
        hasNoAssignee: true,
        isSuspiciouslyLarge: true,
        isCarryover: true,
      }),
    ];
    const ids = computeReadinessWarnings(reviews).map((w) => w.id);
    expect(ids).toContain('no-estimate');
    expect(ids).toContain('no-owner');
    expect(ids).toContain('large-issues');
    expect(ids).toContain('carryover');
    expect(ids.length).toBe(4);
  });

  it('returns multiple warnings when conditions partially overlap', () => {
    const reviews = [
      makeReview({ issueId: 'A', hasNoEstimate: true }),
      makeReview({ issueId: 'B', isCarryover: true }),
    ];
    const ids = computeReadinessWarnings(reviews).map((w) => w.id);
    expect(ids).toContain('no-estimate');
    expect(ids).toContain('carryover');
    expect(ids.length).toBe(2);
  });
});

// ─── isReadinessClean ────────────────────────────────────────────────────────

describe('isReadinessClean', () => {
  it('returns true for empty warnings array', () => {
    expect(isReadinessClean([])).toBe(true);
  });

  it('returns true when all warnings are info severity', () => {
    const warnings: ReadinessWarning[] = [
      {
        id: 'a',
        severity: 'info',
        title: 'A',
        detail: '',
        icon: '',
        affectedIssueIds: [],
      },
      {
        id: 'b',
        severity: 'info',
        title: 'B',
        detail: '',
        icon: '',
        affectedIssueIds: [],
      },
    ];
    expect(isReadinessClean(warnings)).toBe(true);
  });

  it('returns false when any warning has critical severity', () => {
    const warnings: ReadinessWarning[] = [
      {
        id: 'a',
        severity: 'critical',
        title: 'Block',
        detail: '',
        icon: '',
        affectedIssueIds: [],
      },
    ];
    expect(isReadinessClean(warnings)).toBe(false);
  });

  it('returns false when any warning has warning severity', () => {
    const warnings: ReadinessWarning[] = [
      {
        id: 'a',
        severity: 'warning',
        title: 'Heads up',
        detail: '',
        icon: '',
        affectedIssueIds: [],
      },
    ];
    expect(isReadinessClean(warnings)).toBe(false);
  });

  it('returns false when mixed info and critical', () => {
    const warnings: ReadinessWarning[] = [
      {
        id: 'a',
        severity: 'info',
        title: '',
        detail: '',
        icon: '',
        affectedIssueIds: [],
      },
      {
        id: 'b',
        severity: 'critical',
        title: '',
        detail: '',
        icon: '',
        affectedIssueIds: [],
      },
    ];
    expect(isReadinessClean(warnings)).toBe(false);
  });
});
