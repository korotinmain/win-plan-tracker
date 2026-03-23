import { IssueReview } from '../../../../../core/models/planning-session.model';
import { computeCapacity, maxPlannedSP } from './capacity.util';

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

describe('computeCapacity', () => {
  const participantIds = ['uid-alice', 'uid-bob'];
  const participantNames = ['Alice', 'Bob'];

  it('returns one entry per participant when no reviews', () => {
    const result = computeCapacity([], participantIds, participantNames);
    expect(result.length).toBe(2);
    expect(result.every((e) => e.plannedSP === 0)).toBe(true);
  });

  it('accumulates SP for confirmed issues', () => {
    const reviews = [
      makeReview({ assignee: 'Alice', storyPoints: 3, outcome: 'confirmed' }),
      makeReview({ issueId: 'B', assignee: 'Alice', storyPoints: 5, outcome: 'confirmed' }),
    ];
    const result = computeCapacity(reviews, participantIds, participantNames);
    const alice = result.find((e) => e.name === 'Alice')!;
    expect(alice.plannedSP).toBe(8);
  });

  it('accumulates SP for risky-accepted issues', () => {
    const reviews = [
      makeReview({ assignee: 'Bob', storyPoints: 8, outcome: 'risky-accepted' }),
    ];
    const result = computeCapacity(reviews, participantIds, participantNames);
    const bob = result.find((e) => e.name === 'Bob')!;
    expect(bob.plannedSP).toBe(8);
  });

  it('ignores deferred issues', () => {
    const reviews = [
      makeReview({ assignee: 'Alice', storyPoints: 13, outcome: 'deferred' }),
    ];
    const result = computeCapacity(reviews, participantIds, participantNames);
    const alice = result.find((e) => e.name === 'Alice')!;
    expect(alice.plannedSP).toBe(0);
  });

  it('ignores issues with null outcome', () => {
    const reviews = [
      makeReview({ assignee: 'Alice', storyPoints: 5, outcome: null }),
    ];
    const result = computeCapacity(reviews, participantIds, participantNames);
    const alice = result.find((e) => e.name === 'Alice')!;
    expect(alice.plannedSP).toBe(0);
  });

  it('seeds all participants even with zero SP', () => {
    const reviews = [
      makeReview({ assignee: 'Alice', storyPoints: 5, outcome: 'confirmed' }),
    ];
    const result = computeCapacity(reviews, participantIds, participantNames);
    const bob = result.find((e) => e.name === 'Bob')!;
    expect(bob).toBeDefined();
    expect(bob.plannedSP).toBe(0);
  });

  it('creates an unassigned bucket for issues with no assignee', () => {
    const reviews = [
      makeReview({ assignee: null, hasNoAssignee: true, storyPoints: 3, outcome: 'confirmed' }),
    ];
    const result = computeCapacity(reviews, participantIds, participantNames);
    const unassigned = result.find((e) => e.name === 'Unassigned');
    expect(unassigned).toBeDefined();
    expect(unassigned!.plannedSP).toBe(3);
  });

  it('sorts entries by plannedSP descending', () => {
    const reviews = [
      makeReview({ assignee: 'Alice', storyPoints: 2, outcome: 'confirmed' }),
      makeReview({ issueId: 'B', assignee: 'Bob', storyPoints: 10, outcome: 'confirmed' }),
    ];
    const result = computeCapacity(reviews, participantIds, participantNames);
    expect(result[0].name).toBe('Bob');
    expect(result[1].name).toBe('Alice');
  });

  it('marks isOverloaded when plannedSP > availableSP > 0', () => {
    const reviews = [
      makeReview({ assignee: 'Alice', storyPoints: 20, outcome: 'confirmed' }),
    ];
    const result = computeCapacity(reviews, participantIds, participantNames);
    const alice = result.find((e) => e.name === 'Alice')!;
    // availableSP is 0 by default → not overloaded
    expect(alice.isOverloaded).toBe(false);
  });

  it('sets availableSP to 0 by default', () => {
    const result = computeCapacity([], participantIds, participantNames);
    expect(result.every((e) => e.availableSP === 0)).toBe(true);
  });

  it('assigns correct uid to each participant entry', () => {
    const result = computeCapacity([], participantIds, participantNames);
    const alice = result.find((e) => e.uid === 'uid-alice')!;
    expect(alice.name).toBe('Alice');
  });

  it('uses plannedStoryPoints over storyPoints when set', () => {
    const reviews = [
      makeReview({ assignee: 'Alice', storyPoints: 3, plannedStoryPoints: 8, outcome: 'confirmed' }),
    ];
    const result = computeCapacity(reviews, participantIds, participantNames);
    const alice = result.find((e) => e.name === 'Alice')!;
    expect(alice.plannedSP).toBe(8);
  });

  it('falls back to storyPoints when plannedStoryPoints is null', () => {
    const reviews = [
      makeReview({ assignee: 'Alice', storyPoints: 5, plannedStoryPoints: null, outcome: 'confirmed' }),
    ];
    const result = computeCapacity(reviews, participantIds, participantNames);
    const alice = result.find((e) => e.name === 'Alice')!;
    expect(alice.plannedSP).toBe(5);
  });
});

describe('maxPlannedSP', () => {
  it('returns 1 for empty array (floor)', () => {
    expect(maxPlannedSP([])).toBe(1);
  });

  it('returns 1 when all entries have zero SP (floor)', () => {
    const entries = [
      { uid: 'a', name: 'Alice', plannedSP: 0, availableSP: 0, isOverloaded: false },
    ];
    expect(maxPlannedSP(entries)).toBe(1);
  });

  it('returns the maximum plannedSP value', () => {
    const entries = [
      { uid: 'a', name: 'Alice', plannedSP: 8, availableSP: 0, isOverloaded: false },
      { uid: 'b', name: 'Bob', plannedSP: 13, availableSP: 0, isOverloaded: false },
      { uid: 'c', name: 'Carol', plannedSP: 5, availableSP: 0, isOverloaded: false },
    ];
    expect(maxPlannedSP(entries)).toBe(13);
  });
});
