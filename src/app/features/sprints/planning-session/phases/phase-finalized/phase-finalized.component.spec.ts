import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Timestamp } from '@firebase/firestore';
import { PhaseFinalizedComponent } from './phase-finalized.component';
import { IssueReview, PlanningSessionV2 } from '../../../../../core/models/planning-session.model';

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
    status: 'Done',
    statusCategory: 'DONE',
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
    sprintId: 55,
    sprintName: 'Sprint 55',
    sprintGoal: null,
    sprintStartDate: '2026-04-01',
    sprintEndDate: '2026-04-14',
    teamId: 'team-1',
    status: 'completed',
    phase: 'finalized',
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

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('PhaseFinalizedComponent', () => {
  let component: PhaseFinalizedComponent;
  let fixture: ComponentFixture<PhaseFinalizedComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PhaseFinalizedComponent, NoopAnimationsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(PhaseFinalizedComponent);
    component = fixture.componentInstance;
    component.session = makeSession();
    fixture.detectChanges();
  });

  // ── Getters ───────────────────────────────────────────────────────────────

  it('committedSP sums confirmed + risky-accepted SP', () => {
    component.session = makeSession({
      issueReviews: [
        makeReview({ issueId: 'A', outcome: 'confirmed', storyPoints: 10 }),
        makeReview({ issueId: 'B', outcome: 'risky-accepted', storyPoints: 3 }),
        makeReview({ issueId: 'C', outcome: 'deferred', storyPoints: 5 }),
      ],
    });
    fixture.detectChanges();
    expect(component.committedSP).toBe(13);
  });

  it('confirmedCount counts only confirmed', () => {
    component.session = makeSession({
      issueReviews: [
        makeReview({ issueId: 'A', outcome: 'confirmed' }),
        makeReview({ issueId: 'B', outcome: 'confirmed' }),
        makeReview({ issueId: 'C', outcome: 'deferred' }),
      ],
    });
    expect(component.confirmedCount).toBe(2);
  });

  it('deferredCount counts only deferred', () => {
    component.session = makeSession({
      issueReviews: [
        makeReview({ issueId: 'A', outcome: 'deferred' }),
        makeReview({ issueId: 'B', outcome: 'confirmed' }),
      ],
    });
    expect(component.deferredCount).toBe(1);
  });

  it('riskyCount counts only risky-accepted', () => {
    component.session = makeSession({
      issueReviews: [
        makeReview({ issueId: 'A', outcome: 'risky-accepted' }),
        makeReview({ issueId: 'B', outcome: 'risky-accepted' }),
        makeReview({ issueId: 'C', outcome: 'confirmed' }),
      ],
    });
    expect(component.riskyCount).toBe(2);
  });

  it('participantCount returns participant count', () => {
    component.session = makeSession({
      participantIds: ['u1', 'u2', 'u3'],
    });
    expect(component.participantCount).toBe(3);
  });

  it('participantCount returns 0 when participantIds is empty', () => {
    component.session = makeSession({ participantIds: [] });
    expect(component.participantCount).toBe(0);
  });

  // ── Template ──────────────────────────────────────────────────────────────

  it('should display sprint name', () => {
    component.session = makeSession({ sprintName: 'Sprint 99' });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Sprint 99');
  });

  it('should display "Sprint Plan Committed" headline', () => {
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Sprint Plan Committed');
  });

  it('done button should emit done event', () => {
    const doneSpy = jasmine.createSpy('done');
    component.done.subscribe(doneSpy);
    const btn = fixture.debugElement.query(By.css('.fin__done-btn'));
    btn.nativeElement.click();
    expect(doneSpy).toHaveBeenCalled();
  });
});
