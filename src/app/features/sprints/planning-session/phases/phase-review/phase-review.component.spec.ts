import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { SimpleChange } from '@angular/core';
import { Timestamp } from '@firebase/firestore';
import { PhaseReviewComponent } from './phase-review.component';
import {
  IssueOutcome,
  IssueReview,
  PlanningSessionV2,
} from '../../../../../core/models/planning-session.model';
import { PlanningService } from '../../../../../core/services/planning.service';
import { AuthService } from '../../../../../core/services/auth.service';

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
    phase: 'review',
    currentReviewIndex: 0,
    facilitatorId: 'uid-f',
    facilitatorName: 'Alice',
    participantIds: ['uid-f', 'uid-b'],
    participantNames: ['Alice', 'Bob'],
    issueReviews: [
      makeReview({ issueId: 'PROJ-1', issueKey: 'PROJ-1' }),
      makeReview({ issueId: 'PROJ-2', issueKey: 'PROJ-2' }),
      makeReview({ issueId: 'PROJ-3', issueKey: 'PROJ-3' }),
    ],
    issueParticipation: {},
    readinessWarnings: [],
    capacityData: [],
    summary: {
      confirmedCount: 0,
      deferredCount: 0,
      riskyCount: 0,
      unclearCount: 0,
      splitCandidateCount: 0,
      totalIssues: 3,
      totalSP: 15,
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
  updateIssueReviews: jasmine.createSpy('updateIssueReviews').and.returnValue(Promise.resolve()),
  setReviewIndex: jasmine.createSpy('setReviewIndex').and.returnValue(Promise.resolve()),
  markParticipantWeighed: jasmine.createSpy('markParticipantWeighed').and.returnValue(Promise.resolve()),
};

const mockAuthService = {
  currentUser: { uid: 'uid-f', email: 'alice@test.com', teamId: 'team-1' },
};

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('PhaseReviewComponent', () => {
  let component: PhaseReviewComponent;
  let fixture: ComponentFixture<PhaseReviewComponent>;

  function setSession(overrides: Partial<PlanningSessionV2> = {}): void {
    const prev = component.session;
    component.session = makeSession(overrides);
    component.ngOnChanges({
      session: new SimpleChange(prev, component.session, prev == null),
    });
    fixture.detectChanges();
  }

  beforeEach(async () => {
    mockPlanningService.updateIssueReviews.calls.reset();
    mockPlanningService.setReviewIndex.calls.reset();
    mockPlanningService.markParticipantWeighed.calls.reset();

    await TestBed.configureTestingModule({
      imports: [PhaseReviewComponent, NoopAnimationsModule],
      providers: [
        { provide: PlanningService, useValue: mockPlanningService },
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PhaseReviewComponent);
    component = fixture.componentInstance;
    component.isFacilitator = true;
    component.advancing = false;
  });

  it('renders without error', () => {
    setSession();
    expect(component).toBeTruthy();
  });

  // ── Computed: derived from session ───────────────────────────────────────

  it('currentIssue returns issue at currentReviewIndex', () => {
    setSession({ currentReviewIndex: 1 });
    expect(component.currentIssue?.issueId).toBe('PROJ-2');
  });

  it('totalIssues reflects number of issueReviews', () => {
    setSession();
    expect(component.totalIssues).toBe(3);
  });

  it('reviewedCount counts only reviewed issues', () => {
    setSession({
      issueReviews: [
        makeReview({ issueId: 'A', outcome: 'confirmed' }),
        makeReview({ issueId: 'B', outcome: null }),
        makeReview({ issueId: 'C', outcome: 'deferred' }),
      ],
    });
    expect(component.reviewedCount).toBe(2);
  });

  it('progressPct is 0 when none reviewed', () => {
    setSession();
    expect(component.progressPct).toBe(0);
  });

  it('progressPct is 100 when all reviewed', () => {
    setSession({
      issueReviews: [
        makeReview({ issueId: 'A', outcome: 'confirmed' }),
        makeReview({ issueId: 'B', outcome: 'deferred' }),
      ],
    });
    expect(component.progressPct).toBe(100);
  });

  it('progressPct rounds to nearest integer', () => {
    setSession({
      issueReviews: [
        makeReview({ issueId: 'A', outcome: 'confirmed' }),
        makeReview({ issueId: 'B', outcome: null }),
        makeReview({ issueId: 'C', outcome: null }),
      ],
    });
    expect(component.progressPct).toBe(33);
  });

  it('allReviewed is false when some issues have no outcome', () => {
    setSession();
    expect(component.allReviewed).toBe(false);
  });

  it('allReviewed is true when all issues have outcomes', () => {
    setSession({
      issueReviews: [
        makeReview({ issueId: 'A', outcome: 'confirmed' }),
        makeReview({ issueId: 'B', outcome: 'deferred' }),
      ],
    });
    expect(component.allReviewed).toBe(true);
  });

  it('allReviewed is false when issueReviews is empty', () => {
    setSession({ issueReviews: [] });
    expect(component.allReviewed).toBe(false);
  });

  // ── isFirstIssue / isLastIssue ────────────────────────────────────────────

  it('isFirstIssue is true when index is 0', () => {
    setSession({ currentReviewIndex: 0 });
    expect(component.isFirstIssue).toBe(true);
  });

  it('isFirstIssue is false when index > 0', () => {
    setSession({ currentReviewIndex: 1 });
    expect(component.isFirstIssue).toBe(false);
  });

  it('isLastIssue is true when at last index', () => {
    setSession({ currentReviewIndex: 2 });
    expect(component.isLastIssue).toBe(true);
  });

  it('isLastIssue is false when not at last index', () => {
    setSession({ currentReviewIndex: 0 });
    expect(component.isLastIssue).toBe(false);
  });

  // ── participantsWeighedIn ─────────────────────────────────────────────────

  it('participantsWeighedIn returns UIDs for current issue', () => {
    setSession({
      issueParticipation: { 'PROJ-1': ['uid-f', 'uid-b'] },
    });
    expect(component.participantsWeighedIn).toEqual(['uid-f', 'uid-b']);
  });

  it('participantsWeighedIn returns empty array when no participation', () => {
    setSession({ issueParticipation: {} });
    expect(component.participantsWeighedIn).toEqual([]);
  });

  it('hasCurrentUserWeighedIn is true when current user is in list', () => {
    setSession({
      issueParticipation: { 'PROJ-1': ['uid-f'] },
    });
    expect(component.hasCurrentUserWeighedIn).toBe(true);
  });

  it('hasCurrentUserWeighedIn is false when current user is not in list', () => {
    setSession({ issueParticipation: { 'PROJ-1': ['uid-b'] } });
    expect(component.hasCurrentUserWeighedIn).toBe(false);
  });

  // ── Local state sync ──────────────────────────────────────────────────────

  it('syncs localOutcome from session on index change', () => {
    setSession({
      currentReviewIndex: 0,
      issueReviews: [
        makeReview({ issueId: 'A', outcome: 'confirmed' }),
        makeReview({ issueId: 'B', outcome: 'deferred' }),
      ],
    });
    expect(component.localOutcome()).toBe('confirmed');

    // Simulate navigation to index 1
    component.session = makeSession({
      currentReviewIndex: 1,
      issueReviews: [
        makeReview({ issueId: 'A', outcome: 'confirmed' }),
        makeReview({ issueId: 'B', outcome: 'deferred' }),
      ],
    });
    component.ngOnChanges({
      session: new SimpleChange(component.session, component.session, false),
    });
    expect(component.localOutcome()).toBe('deferred');
  });

  it('syncs localNotes from session on index change', () => {
    setSession({
      currentReviewIndex: 0,
      issueReviews: [makeReview({ issueId: 'A', notes: 'some note' })],
    });
    expect(component.localNotes()).toBe('some note');
  });

  // ── setOutcome ────────────────────────────────────────────────────────────

  it('setOutcome updates localOutcome signal', fakeAsync(async () => {
    setSession();
    await component.setOutcome('confirmed');
    tick();
    expect(component.localOutcome()).toBe('confirmed');
  }));

  it('setOutcome calls updateIssueReviews', fakeAsync(async () => {
    setSession();
    await component.setOutcome('deferred');
    tick();
    expect(mockPlanningService.updateIssueReviews).toHaveBeenCalledWith(
      'session-1',
      jasmine.any(Array),
    );
  }));

  it('setOutcome toggles off when same outcome is clicked again', fakeAsync(async () => {
    setSession({
      issueReviews: [makeReview({ issueId: 'A', outcome: 'confirmed' })],
    });
    component.localOutcome.set('confirmed');
    await component.setOutcome('confirmed');
    tick();
    expect(component.localOutcome()).toBeNull();
  }));

  it('setOutcome does nothing when not facilitator', fakeAsync(async () => {
    component.isFacilitator = false;
    setSession();
    await component.setOutcome('confirmed');
    tick();
    expect(mockPlanningService.updateIssueReviews).not.toHaveBeenCalled();
  }));

  // ── Navigation ────────────────────────────────────────────────────────────

  it('navNext calls setReviewIndex with incremented index', fakeAsync(async () => {
    setSession({ currentReviewIndex: 0 });
    await component.navNext();
    tick();
    expect(mockPlanningService.setReviewIndex).toHaveBeenCalledWith(
      'session-1',
      1,
    );
  }));

  it('navNext does not call setReviewIndex when already at last issue', fakeAsync(async () => {
    setSession({ currentReviewIndex: 2 });
    await component.navNext();
    tick();
    expect(mockPlanningService.setReviewIndex).not.toHaveBeenCalled();
  }));

  it('navPrev calls setReviewIndex with decremented index', fakeAsync(async () => {
    setSession({ currentReviewIndex: 1 });
    await component.navPrev();
    tick();
    expect(mockPlanningService.setReviewIndex).toHaveBeenCalledWith(
      'session-1',
      0,
    );
  }));

  it('navPrev does not call setReviewIndex when at first issue', fakeAsync(async () => {
    setSession({ currentReviewIndex: 0 });
    await component.navPrev();
    tick();
    expect(mockPlanningService.setReviewIndex).not.toHaveBeenCalled();
  }));

  // ── markWeighed ───────────────────────────────────────────────────────────

  it('markWeighed calls markParticipantWeighed with correct args', fakeAsync(async () => {
    setSession({ issueParticipation: {} });
    await component.markWeighed();
    tick();
    expect(mockPlanningService.markParticipantWeighed).toHaveBeenCalledWith(
      'session-1',
      'PROJ-1',
      'uid-f',
    );
  }));

  it('markWeighed does not call service when already weighed in', fakeAsync(async () => {
    setSession({ issueParticipation: { 'PROJ-1': ['uid-f'] } });
    await component.markWeighed();
    tick();
    expect(mockPlanningService.markParticipantWeighed).not.toHaveBeenCalled();
  }));

  // ── Helper methods ────────────────────────────────────────────────────────

  describe('getTypeIcon()', () => {
    it('returns bug_report for Bug', () => expect(component.getTypeIcon('Bug')).toBe('bug_report'));
    it('returns bookmark for Story', () => expect(component.getTypeIcon('Story')).toBe('bookmark'));
    it('returns task_alt for Task', () => expect(component.getTypeIcon('Task')).toBe('task_alt'));
    it('returns circle for unknown', () => expect(component.getTypeIcon('Unknown')).toBe('circle'));
  });

  describe('getPriorityIcon()', () => {
    it('returns keyboard_arrow_up for High', () => expect(component.getPriorityIcon('High')).toBe('keyboard_arrow_up'));
    it('returns keyboard_arrow_down for Low', () => expect(component.getPriorityIcon('Low')).toBe('keyboard_arrow_down'));
    it('returns drag_handle for Medium', () => expect(component.getPriorityIcon('Medium')).toBe('drag_handle'));
    it('returns error for Critical', () => expect(component.getPriorityIcon('Critical')).toBe('error'));
  });

  // ── Template: facilitator vs. observer ───────────────────────────────────

  it('shows outcome buttons when facilitator', () => {
    component.isFacilitator = true;
    setSession();
    const grid = fixture.nativeElement.querySelector('.rev__outcome-grid');
    expect(grid).toBeTruthy();
  });

  it('does not show outcome buttons for observer', () => {
    component.isFacilitator = false;
    setSession();
    const grid = fixture.nativeElement.querySelector('.rev__outcome-grid');
    expect(grid).toBeNull();
  });

  it('shows observer view for non-facilitator', () => {
    component.isFacilitator = false;
    setSession();
    const obs = fixture.nativeElement.querySelector('.rev__observer-view');
    expect(obs).toBeTruthy();
  });

  // ── Template: finish button ───────────────────────────────────────────────

  it('finish button is disabled when not all reviewed', () => {
    component.isFacilitator = true;
    setSession(); // no outcomes set
    const btn = fixture.nativeElement.querySelector('.rev__finish-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('finish button has ready class when all reviewed', () => {
    component.isFacilitator = true;
    setSession({
      issueReviews: [
        makeReview({ issueId: 'A', outcome: 'confirmed' }),
        makeReview({ issueId: 'B', outcome: 'deferred' }),
        makeReview({ issueId: 'C', outcome: 'risky-accepted' }),
      ],
    });
    const btn = fixture.nativeElement.querySelector('.rev__finish-btn');
    expect(btn.classList).toContain('rev__finish-btn--ready');
  });

  // ── Outputs ───────────────────────────────────────────────────────────────

  it('emits advance when finish button clicked and all reviewed', () => {
    component.isFacilitator = true;
    setSession({
      issueReviews: [
        makeReview({ issueId: 'A', outcome: 'confirmed' }),
        makeReview({ issueId: 'B', outcome: 'confirmed' }),
        makeReview({ issueId: 'C', outcome: 'confirmed' }),
      ],
    });
    let emitted = false;
    component.advance.subscribe(() => (emitted = true));
    const btn = fixture.debugElement.query(By.css('.rev__finish-btn'));
    btn.nativeElement.click();
    expect(emitted).toBeTrue();
  });

  it('emits back when Context button clicked', () => {
    setSession();
    let emitted = false;
    component.back.subscribe(() => (emitted = true));
    const btn = fixture.debugElement.query(By.css('.rev__nav-btn'));
    btn.nativeElement.click();
    expect(emitted).toBeTrue();
  });

  // ── Empty state ───────────────────────────────────────────────────────────

  it('shows empty state when there are no issues', () => {
    setSession({ issueReviews: [] });
    const empty = fixture.nativeElement.querySelector('.rev__empty');
    expect(empty).toBeTruthy();
  });

  it('shows issue card when there are issues', () => {
    setSession();
    const card = fixture.nativeElement.querySelector('.rev__issue-card');
    expect(card).toBeTruthy();
  });
});
