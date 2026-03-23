import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { SimpleChange } from '@angular/core';
import { Timestamp } from '@firebase/firestore';
import { PhaseFinalReviewComponent } from './phase-final-review.component';
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
    status: 'completed',
    phase: 'final-review',
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

// ─── Mock ─────────────────────────────────────────────────────────────────────

const mockPlanningService = {
  finalizeSessionV2: jasmine
    .createSpy('finalizeSessionV2')
    .and.returnValue(Promise.resolve()),
};

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('PhaseFinalReviewComponent', () => {
  let component: PhaseFinalReviewComponent;
  let fixture: ComponentFixture<PhaseFinalReviewComponent>;

  function setSession(overrides: Partial<PlanningSessionV2> = {}): void {
    const prev = component.session;
    component.session = makeSession(overrides);
    component.ngOnChanges({
      session: new SimpleChange(prev, component.session, prev == null),
    });
    fixture.detectChanges();
  }

  beforeEach(async () => {
    mockPlanningService.finalizeSessionV2.calls.reset();
    await TestBed.configureTestingModule({
      imports: [PhaseFinalReviewComponent, NoopAnimationsModule],
      providers: [{ provide: PlanningService, useValue: mockPlanningService }],
    }).compileComponents();

    fixture = TestBed.createComponent(PhaseFinalReviewComponent);
    component = fixture.componentInstance;
    component.isFacilitator = true;
    component.advancing = false;
    setSession();
  });

  // ── buildGroups ───────────────────────────────────────────────────────────

  it('should populate grouped map from issueReviews', () => {
    setSession({
      issueReviews: [
        makeReview({ issueId: 'A', outcome: 'confirmed' }),
        makeReview({ issueId: 'B', outcome: 'deferred' }),
        makeReview({ issueId: 'C', outcome: 'deferred' }),
      ],
    });
    expect(component.groupFor('confirmed').length).toBe(1);
    expect(component.groupFor('deferred').length).toBe(2);
    expect(component.groupFor('risky-accepted').length).toBe(0);
  });

  it('should rebuild groups on session change', () => {
    setSession({ issueReviews: [makeReview({ issueId: 'A', outcome: 'confirmed' })] });
    expect(component.groupFor('confirmed').length).toBe(1);

    setSession({ issueReviews: [makeReview({ issueId: 'A', outcome: 'confirmed' }), makeReview({ issueId: 'B', outcome: 'confirmed' })] });
    expect(component.groupFor('confirmed').length).toBe(2);
  });

  it('should ignore reviews with null outcome', () => {
    setSession({
      issueReviews: [makeReview({ issueId: 'A', outcome: null })],
    });
    expect(component.totalReviewed).toBe(0);
  });

  // ── Getters ───────────────────────────────────────────────────────────────

  it('committedSP sums confirmed + risky-accepted SP', () => {
    setSession({
      issueReviews: [
        makeReview({ issueId: 'A', outcome: 'confirmed', storyPoints: 5 }),
        makeReview({ issueId: 'B', outcome: 'risky-accepted', storyPoints: 8 }),
        makeReview({ issueId: 'C', outcome: 'deferred', storyPoints: 3 }),
      ],
    });
    expect(component.committedSP).toBe(13);
  });

  it('confirmedCount counts only confirmed outcome', () => {
    setSession({
      issueReviews: [
        makeReview({ issueId: 'A', outcome: 'confirmed' }),
        makeReview({ issueId: 'B', outcome: 'confirmed' }),
        makeReview({ issueId: 'C', outcome: 'risky-accepted' }),
      ],
    });
    expect(component.confirmedCount).toBe(2);
  });

  it('deferredCount counts only deferred outcome', () => {
    setSession({
      issueReviews: [
        makeReview({ issueId: 'A', outcome: 'deferred' }),
        makeReview({ issueId: 'B', outcome: 'confirmed' }),
      ],
    });
    expect(component.deferredCount).toBe(1);
  });

  it('totalReviewed counts issues with non-null outcome', () => {
    setSession({
      issueReviews: [
        makeReview({ issueId: 'A', outcome: 'confirmed' }),
        makeReview({ issueId: 'B', outcome: null }),
        makeReview({ issueId: 'C', outcome: 'deferred' }),
      ],
    });
    expect(component.totalReviewed).toBe(2);
  });

  // ── finalize ──────────────────────────────────────────────────────────────

  it('finalize() should call finalizeSessionV2 and emit advance', fakeAsync(() => {
    const advanceSpy = jasmine.createSpy('advance');
    component.advance.subscribe(advanceSpy);

    setSession();
    component.finalize();
    tick();

    expect(mockPlanningService.finalizeSessionV2).toHaveBeenCalledWith(
      'session-1',
      jasmine.any(Array),
      jasmine.any(Array),
    );
    expect(advanceSpy).toHaveBeenCalled();
  }));

  it('finalize() should not call service when not facilitator', fakeAsync(() => {
    component.isFacilitator = false;
    fixture.detectChanges();

    component.finalize();
    tick();

    expect(mockPlanningService.finalizeSessionV2).not.toHaveBeenCalled();
  }));

  it('finalize() should not call service when session has no id', fakeAsync(() => {
    setSession();
    component.session = { ...component.session, id: undefined };

    component.finalize();
    tick();

    expect(mockPlanningService.finalizeSessionV2).not.toHaveBeenCalled();
  }));

  it('finalizing signal should be true while awaiting and false after', fakeAsync(() => {
    let resolvePromise!: () => void;
    mockPlanningService.finalizeSessionV2.and.returnValue(
      new Promise<void>((r) => (resolvePromise = r)),
    );

    setSession();
    component.finalize();
    expect(component.finalizing()).toBeTrue();

    resolvePromise();
    tick();
    expect(component.finalizing()).toBeFalse();
  }));

  // ── getTypeIcon ───────────────────────────────────────────────────────────

  it('getTypeIcon returns correct icons', () => {
    expect(component.getTypeIcon('Story')).toBe('bookmark');
    expect(component.getTypeIcon('Bug')).toBe('bug_report');
    expect(component.getTypeIcon('Task')).toBe('task_alt');
    expect(component.getTypeIcon('Epic')).toBe('auto_awesome');
    expect(component.getTypeIcon('unknown')).toBe('circle');
  });

  // ── Template: facilitator vs observer ─────────────────────────────────────

  it('should render finalize button for facilitator', () => {
    component.isFacilitator = true;
    fixture.detectChanges();
    const btn = fixture.debugElement.query(By.css('.fr__finalize-btn'));
    expect(btn).toBeTruthy();
  });

  it('should render observer waiting message when not facilitator', () => {
    component.isFacilitator = false;
    fixture.detectChanges();
    const observer = fixture.debugElement.query(By.css('.fr__observer'));
    expect(observer).toBeTruthy();
    const btn = fixture.debugElement.query(By.css('.fr__finalize-btn'));
    expect(btn).toBeNull();
  });

  // ── Template: issue groups ─────────────────────────────────────────────────

  it('should display group sections for non-empty outcomes only', () => {
    setSession({
      issueReviews: [
        makeReview({ issueId: 'A', outcome: 'confirmed' }),
        makeReview({ issueId: 'B', outcome: 'deferred' }),
      ],
    });
    const groups = fixture.debugElement.queryAll(By.css('.fr__group'));
    expect(groups.length).toBe(2);
  });

  it('should display sprint name in header', () => {
    setSession({ sprintName: 'Sprint 99' });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Sprint 99');
  });
});
