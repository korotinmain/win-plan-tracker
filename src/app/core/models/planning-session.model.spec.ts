import {
  IssueReview,
  computeSessionSummary,
  effectiveSP,
  isPlanningSessionV2,
} from './planning-session.model';

// ─── Factory helpers ──────────────────────────────────────────────────────────

function makeReview(
  overrides: Partial<IssueReview> = {},
): IssueReview {
  return {
    issueId: 'PROJ-1',
    issueKey: 'PROJ-1',
    title: 'Test issue',
    storyPoints: 3,
    assignee: 'Alice',
    type: 'Story',
    priority: 'Medium',
    status: 'To Do',
    statusCategory: 'new',
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

// ─── isPlanningSessionV2 ──────────────────────────────────────────────────────

describe('isPlanningSessionV2', () => {
  it('returns true when schemaVersion is 2', () => {
    expect(isPlanningSessionV2({ schemaVersion: 2 })).toBeTrue();
  });

  it('returns false when schemaVersion is 1', () => {
    expect(isPlanningSessionV2({ schemaVersion: 1 })).toBeFalse();
  });

  it('returns false when schemaVersion is missing', () => {
    expect(isPlanningSessionV2({})).toBeFalse();
  });

  it('returns false when schemaVersion is a string', () => {
    expect(isPlanningSessionV2({ schemaVersion: '2' })).toBeFalse();
  });

  it('returns false when schemaVersion is null', () => {
    expect(isPlanningSessionV2({ schemaVersion: null })).toBeFalse();
  });
});

// ─── computeSessionSummary ────────────────────────────────────────────────────

describe('computeSessionSummary', () => {
  it('returns zeroed summary for an empty review list', () => {
    expect(computeSessionSummary([])).toEqual({
      confirmedCount: 0,
      deferredCount: 0,
      riskyCount: 0,
      unclearCount: 0,
      splitCandidateCount: 0,
      totalIssues: 0,
      totalSP: 0,
      committedSP: 0,
    });
  });

  it('counts confirmed issues and includes their SP in committedSP', () => {
    const reviews = [
      makeReview({ outcome: 'confirmed', storyPoints: 5 }),
      makeReview({ outcome: 'confirmed', storyPoints: 3 }),
    ];
    const summary = computeSessionSummary(reviews);
    expect(summary.confirmedCount).toBe(2);
    expect(summary.committedSP).toBe(8);
  });

  it('counts risky-accepted issues and includes their SP in committedSP', () => {
    const reviews = [makeReview({ outcome: 'risky-accepted', storyPoints: 8 })];
    const summary = computeSessionSummary(reviews);
    expect(summary.riskyCount).toBe(1);
    expect(summary.committedSP).toBe(8);
  });

  it('counts deferred issues and excludes their SP from committedSP', () => {
    const reviews = [makeReview({ outcome: 'deferred', storyPoints: 5 })];
    const summary = computeSessionSummary(reviews);
    expect(summary.deferredCount).toBe(1);
    expect(summary.committedSP).toBe(0);
  });

  it('counts needs-clarification issues', () => {
    const reviews = [makeReview({ outcome: 'needs-clarification', storyPoints: 2 })];
    const summary = computeSessionSummary(reviews);
    expect(summary.unclearCount).toBe(1);
    expect(summary.committedSP).toBe(0);
  });

  it('counts split-candidate issues', () => {
    const reviews = [makeReview({ outcome: 'split-candidate', storyPoints: 13 })];
    const summary = computeSessionSummary(reviews);
    expect(summary.splitCandidateCount).toBe(1);
    expect(summary.committedSP).toBe(0);
  });

  it('counts unreviewed (null outcome) issues — totalIssues includes them', () => {
    const reviews = [makeReview({ outcome: null, storyPoints: 5 })];
    const summary = computeSessionSummary(reviews);
    expect(summary.totalIssues).toBe(1);
    expect(summary.confirmedCount).toBe(0);
    expect(summary.committedSP).toBe(0);
  });

  it('accumulates totalSP from all issues regardless of outcome', () => {
    const reviews = [
      makeReview({ outcome: 'confirmed', storyPoints: 5 }),
      makeReview({ outcome: 'deferred', storyPoints: 3 }),
      makeReview({ outcome: null, storyPoints: 8 }),
    ];
    expect(computeSessionSummary(reviews).totalSP).toBe(16);
  });

  it('sets totalIssues to the length of the reviews array', () => {
    const reviews = [
      makeReview({ outcome: 'confirmed' }),
      makeReview({ outcome: 'deferred' }),
      makeReview({ outcome: null }),
    ];
    expect(computeSessionSummary(reviews).totalIssues).toBe(3);
  });

  it('handles mixed outcomes correctly in a single pass', () => {
    const reviews = [
      makeReview({ outcome: 'confirmed', storyPoints: 5 }),
      makeReview({ outcome: 'risky-accepted', storyPoints: 8 }),
      makeReview({ outcome: 'deferred', storyPoints: 3 }),
      makeReview({ outcome: 'needs-clarification', storyPoints: 2 }),
      makeReview({ outcome: 'split-candidate', storyPoints: 13 }),
    ];
    const summary = computeSessionSummary(reviews);
    expect(summary.confirmedCount).toBe(1);
    expect(summary.riskyCount).toBe(1);
    expect(summary.deferredCount).toBe(1);
    expect(summary.unclearCount).toBe(1);
    expect(summary.splitCandidateCount).toBe(1);
    expect(summary.totalIssues).toBe(5);
    expect(summary.totalSP).toBe(31);
    expect(summary.committedSP).toBe(13); // confirmed + risky
  });

  it('is a pure function — does not mutate its input array', () => {
    const reviews = [makeReview({ outcome: 'confirmed', storyPoints: 5 })];
    const copy = [...reviews];
    computeSessionSummary(reviews);
    expect(reviews).toEqual(copy);
  });

  it('uses plannedStoryPoints for committedSP when set', () => {
    const reviews = [
      makeReview({ outcome: 'confirmed', storyPoints: 5, plannedStoryPoints: 8 }),
    ];
    const summary = computeSessionSummary(reviews);
    expect(summary.committedSP).toBe(8);
    expect(summary.totalSP).toBe(8);
  });

  it('falls back to storyPoints when plannedStoryPoints is null', () => {
    const reviews = [
      makeReview({ outcome: 'confirmed', storyPoints: 5, plannedStoryPoints: null }),
    ];
    expect(computeSessionSummary(reviews).committedSP).toBe(5);
  });

  it('falls back to storyPoints when plannedStoryPoints is not set', () => {
    const reviews = [makeReview({ outcome: 'confirmed', storyPoints: 5 })];
    expect(computeSessionSummary(reviews).committedSP).toBe(5);
  });
});

// ─── effectiveSP ──────────────────────────────────────────────────────────────

describe('effectiveSP', () => {
  it('returns storyPoints when plannedStoryPoints is not set', () => {
    expect(effectiveSP(makeReview({ storyPoints: 5 }))).toBe(5);
  });

  it('returns storyPoints when plannedStoryPoints is null', () => {
    expect(effectiveSP(makeReview({ storyPoints: 5, plannedStoryPoints: null }))).toBe(5);
  });

  it('returns plannedStoryPoints when it is set', () => {
    expect(effectiveSP(makeReview({ storyPoints: 5, plannedStoryPoints: 8 }))).toBe(8);
  });

  it('returns plannedStoryPoints of 0 when explicitly set to 0', () => {
    expect(effectiveSP(makeReview({ storyPoints: 5, plannedStoryPoints: 0 }))).toBe(0);
  });

  it('returns 0 when both storyPoints and plannedStoryPoints are 0', () => {
    expect(effectiveSP(makeReview({ storyPoints: 0 }))).toBe(0);
  });
});
