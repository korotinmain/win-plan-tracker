import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { SimpleChange } from '@angular/core';
import { Timestamp } from '@firebase/firestore';
import { PhaseBalancingComponent } from './phase-balancing.component';
import {
  IssueReview,
  PlanningSessionV2,
} from '../../../../../core/models/planning-session.model';
import { PlanningService } from '../../../../../core/services/planning.service';

// ─── Factories ────────────────────────────────────────────────────────────────

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

function makeSession(
  overrides: Partial<PlanningSessionV2> = {},
): PlanningSessionV2 {
  const now = Timestamp.now();
  return {
    schemaVersion: 2,
    id: 'session-1',
    sprintId: 42,
    sprintName: 'Sprint 42',
    sprintGoal: null,
    sprintStartDate: '2026-04-01',
    sprintEndDate: '2026-04-14',
    teamId: 'team-1',
    status: 'draft',
    phase: 'balancing',
    currentReviewIndex: 0,
    facilitatorId: 'uid-f',
    facilitatorName: 'Alice',
    participantIds: ['uid-f', 'uid-b'],
    participantNames: ['Alice', 'Bob'],
    issueReviews: [],
    issueParticipation: {},
    readinessWarnings: [],
    capacityData: [],
    summary: {
      confirmedCount: 0,
      deferredCount: 0,
      riskyCount: 0,
      unclearCount: 0,
      splitCandidateCount: 0,
      totalIssues: 0,
      totalSP: 0,
      committedSP: 0,
    },
    createdBy: 'uid-f',
    createdByName: 'Alice',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// ─── Mock services ────────────────────────────────────────────────────────────

const mockPlanningService = {
  updateCapacityAndSummary: jasmine
    .createSpy('updateCapacityAndSummary')
    .and.returnValue(Promise.resolve()),
};

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('PhaseBalancingComponent', () => {
  let component: PhaseBalancingComponent;
  let fixture: ComponentFixture<PhaseBalancingComponent>;

  function setSession(overrides: Partial<PlanningSessionV2> = {}): void {
    const prev = component.session;
    component.session = makeSession(overrides);
    component.ngOnChanges({
      session: new SimpleChange(prev, component.session, prev == null),
    });
    fixture.detectChanges();
  }

  beforeEach(async () => {
    mockPlanningService.updateCapacityAndSummary.calls.reset();

    await TestBed.configureTestingModule({
      imports: [PhaseBalancingComponent, NoopAnimationsModule],
      providers: [
        { provide: PlanningService, useValue: mockPlanningService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PhaseBalancingComponent);
    component = fixture.componentInstance;
    component.isFacilitator = true;
    component.advancing = false;
  });

  it('renders without error', () => {
    setSession();
    expect(component).toBeTruthy();
  });

  // ── Stats ─────────────────────────────────────────────────────────────────

  it('totalCommittedSP reflects confirmed + risky-accepted SP', () => {
    setSession({
      issueReviews: [
        makeReview({ issueId: 'A', storyPoints: 5, outcome: 'confirmed' }),
        makeReview({ issueId: 'B', storyPoints: 3, outcome: 'risky-accepted' }),
        makeReview({ issueId: 'C', storyPoints: 8, outcome: 'deferred' }),
      ],
    });
    expect(component.totalCommittedSP()).toBe(8);
  });

  it('totalIssues counts only committed issues', () => {
    setSession({
      issueReviews: [
        makeReview({ issueId: 'A', outcome: 'confirmed' }),
        makeReview({ issueId: 'B', outcome: 'deferred' }),
      ],
    });
    expect(component.totalIssues()).toBe(1);
  });

  it('shows zero stats when no reviews', () => {
    setSession({ issueReviews: [] });
    expect(component.totalCommittedSP()).toBe(0);
    expect(component.totalIssues()).toBe(0);
  });

  // ── Lanes ─────────────────────────────────────────────────────────────────

  it('creates one lane per participant', () => {
    setSession({ issueReviews: [] });
    expect(component.lanes().length).toBe(2);
  });

  it('each lane has a name from participantNames', () => {
    setSession();
    const names = component.lanes().map((l) => l.name);
    expect(names).toContain('Alice');
    expect(names).toContain('Bob');
  });

  it('lane plannedSP includes confirmed issues for that person', () => {
    setSession({
      issueReviews: [
        makeReview({ issueId: 'A', assignee: 'Alice', storyPoints: 8, outcome: 'confirmed' }),
      ],
    });
    const alice = component.lanes().find((l) => l.name === 'Alice')!;
    expect(alice.plannedSP).toBe(8);
  });

  it('lanes are sorted by plannedSP descending', () => {
    setSession({
      issueReviews: [
        makeReview({ issueId: 'A', assignee: 'Alice', storyPoints: 3, outcome: 'confirmed' }),
        makeReview({ issueId: 'B', assignee: 'Bob', storyPoints: 10, outcome: 'confirmed' }),
      ],
    });
    expect(component.lanes()[0].name).toBe('Bob');
  });

  it('lane issues list contains committed issues for that person', () => {
    setSession({
      issueReviews: [
        makeReview({ issueId: 'A', assignee: 'Alice', storyPoints: 5, outcome: 'confirmed' }),
        makeReview({ issueId: 'B', assignee: 'Bob', storyPoints: 5, outcome: 'confirmed' }),
      ],
    });
    const alice = component.lanes().find((l) => l.name === 'Alice')!;
    expect(alice.issues.length).toBe(1);
    expect(alice.issues[0].issueId).toBe('A');
  });

  it('deferred issues do not appear in any lane issues list', () => {
    setSession({
      issueReviews: [
        makeReview({ issueId: 'D', assignee: 'Alice', storyPoints: 5, outcome: 'deferred' }),
      ],
    });
    const alice = component.lanes().find((l) => l.name === 'Alice')!;
    expect(alice.issues.length).toBe(0);
  });

  it('barPct is 100 for the person with the highest SP', () => {
    setSession({
      issueReviews: [
        makeReview({ issueId: 'A', assignee: 'Alice', storyPoints: 10, outcome: 'confirmed' }),
        makeReview({ issueId: 'B', assignee: 'Bob', storyPoints: 5, outcome: 'confirmed' }),
      ],
    });
    const alice = component.lanes().find((l) => l.name === 'Alice')!;
    expect(alice.barPct).toBe(100);
    const bob = component.lanes().find((l) => l.name === 'Bob')!;
    expect(bob.barPct).toBe(50);
  });

  it('shows global empty state when no lanes have issues', () => {
    setSession({ issueReviews: [], participantIds: [], participantNames: [] });
    const empty = fixture.nativeElement.querySelector('.bal__global-empty');
    expect(empty).toBeTruthy();
  });

  // ── Template: lanes ───────────────────────────────────────────────────────

  it('renders a lane card per participant', () => {
    setSession({ issueReviews: [] });
    const laneCards = fixture.nativeElement.querySelectorAll('.bal__lane');
    expect(laneCards.length).toBe(2);
  });

  it('shows lane-empty message when person has no committed issues', () => {
    setSession({ issueReviews: [] });
    const laneEmpties = fixture.nativeElement.querySelectorAll('.bal__lane-empty');
    expect(laneEmpties.length).toBe(2);
  });

  // ── Facilitator vs observer ───────────────────────────────────────────────

  it('shows footer when facilitator', () => {
    component.isFacilitator = true;
    setSession();
    expect(fixture.nativeElement.querySelector('.bal__footer')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.bal__observer')).toBeNull();
  });

  it('shows observer state when not facilitator', () => {
    component.isFacilitator = false;
    setSession();
    expect(fixture.nativeElement.querySelector('.bal__observer')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.bal__footer')).toBeNull();
  });

  // ── saveAndAdvance ────────────────────────────────────────────────────────

  it('saveAndAdvance calls updateCapacityAndSummary', fakeAsync(async () => {
    setSession();
    await component.saveAndAdvance();
    tick();
    expect(mockPlanningService.updateCapacityAndSummary).toHaveBeenCalledWith(
      'session-1',
      jasmine.any(Array),
      jasmine.any(Object),
    );
  }));

  it('saveAndAdvance emits advance after saving', fakeAsync(async () => {
    setSession();
    let emitted = false;
    component.advance.subscribe(() => (emitted = true));
    await component.saveAndAdvance();
    tick();
    expect(emitted).toBeTrue();
  }));

  it('saveAndAdvance does nothing when not facilitator', fakeAsync(async () => {
    component.isFacilitator = false;
    setSession();
    await component.saveAndAdvance();
    tick();
    expect(mockPlanningService.updateCapacityAndSummary).not.toHaveBeenCalled();
  }));

  // ── Outputs ───────────────────────────────────────────────────────────────

  it('emits back when Back button clicked', () => {
    component.isFacilitator = true;
    setSession();
    let emitted = false;
    component.back.subscribe(() => (emitted = true));
    const btn = fixture.debugElement.query(By.css('.bal__back-btn'));
    btn.nativeElement.click();
    expect(emitted).toBeTrue();
  });

  // ── getTypeIcon ───────────────────────────────────────────────────────────

  it('returns bug_report for Bug', () => expect(component.getTypeIcon('Bug')).toBe('bug_report'));
  it('returns bookmark for Story', () => expect(component.getTypeIcon('Story')).toBe('bookmark'));
  it('returns circle for unknown', () => expect(component.getTypeIcon('Unknown')).toBe('circle'));
});
