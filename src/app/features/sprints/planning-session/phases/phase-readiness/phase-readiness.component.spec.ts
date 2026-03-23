import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatButtonModule } from '@angular/material/button';
import { SimpleChange } from '@angular/core';
import { Timestamp } from '@firebase/firestore';
import { PhaseReadinessComponent } from './phase-readiness.component';
import {
  IssueReview,
  PlanningSessionV2,
} from '../../../../../core/models/planning-session.model';

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
    phase: 'readiness',
    currentReviewIndex: 0,
    facilitatorId: 'uid-f',
    facilitatorName: 'Alice',
    participantIds: ['uid-f'],
    participantNames: ['Alice'],
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

describe('PhaseReadinessComponent', () => {
  let component: PhaseReadinessComponent;
  let fixture: ComponentFixture<PhaseReadinessComponent>;

  function setSession(overrides: Partial<PlanningSessionV2> = {}): void {
    const prev = component.session;
    component.session = makeSession(overrides);
    component.ngOnChanges({
      session: new SimpleChange(prev, component.session, prev == null),
    });
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PhaseReadinessComponent, NoopAnimationsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(PhaseReadinessComponent);
    component = fixture.componentInstance;
    component.isFacilitator = false;
    component.advancing = false;
  });

  it('renders without error', () => {
    setSession();
    expect(component).toBeTruthy();
  });

  // ── Clean state ──────────────────────────────────────────────────────────

  it('shows clean state when no warnings', () => {
    setSession({ issueReviews: [makeReview()] });
    expect(component.isClean).toBe(true);
    expect(component.warnings().length).toBe(0);
  });

  it('renders empty state element when no warnings', () => {
    setSession({ issueReviews: [makeReview()] });
    const empty = fixture.nativeElement.querySelector('.pr__empty');
    expect(empty).toBeTruthy();
  });

  // ── Warning display ───────────────────────────────────────────────────────

  it('computes warnings from issueReviews on ngOnChanges', () => {
    setSession({
      issueReviews: [makeReview({ issueId: 'A', hasNoEstimate: true })],
    });
    expect(component.warnings().length).toBeGreaterThan(0);
    expect(component.warnings()[0].id).toBe('no-estimate');
  });

  it('renders a card for each warning', () => {
    setSession({
      issueReviews: [
        makeReview({ issueId: 'A', hasNoEstimate: true }),
        makeReview({ issueId: 'B', isCarryover: true }),
      ],
    });
    const cards = fixture.nativeElement.querySelectorAll('.pr__card');
    expect(cards.length).toBe(2);
  });

  it('criticalCount only counts critical severity', () => {
    setSession({
      issueReviews: [
        makeReview({ issueId: 'A', isCarryover: true }),
        makeReview({ issueId: 'B', hasNoEstimate: true }),
      ],
    });
    expect(component.criticalCount).toBe(1);
    expect(component.warningCount).toBe(1);
    expect(component.infoCount).toBe(0);
  });

  it('isClean is false when warning-level warnings exist', () => {
    setSession({
      issueReviews: [makeReview({ hasNoEstimate: true })],
    });
    expect(component.isClean).toBe(false);
  });

  // ── Expand / collapse ─────────────────────────────────────────────────────

  it('toggle expands a warning card', () => {
    setSession({
      issueReviews: [makeReview({ issueId: 'A', hasNoEstimate: true })],
    });
    const warningId = component.warnings()[0].id;
    expect(component.isExpanded(warningId)).toBe(false);
    component.toggle(warningId);
    expect(component.isExpanded(warningId)).toBe(true);
  });

  it('toggle collapses an already-expanded card', () => {
    setSession({
      issueReviews: [makeReview({ issueId: 'A', hasNoEstimate: true })],
    });
    const warningId = component.warnings()[0].id;
    component.toggle(warningId);
    component.toggle(warningId);
    expect(component.isExpanded(warningId)).toBe(false);
  });

  it('toggling one card collapses the other', () => {
    setSession({
      issueReviews: [
        makeReview({ issueId: 'A', hasNoEstimate: true }),
        makeReview({ issueId: 'B', isCarryover: true }),
      ],
    });
    const [id1, id2] = component.warnings().map((w) => w.id);
    component.toggle(id1);
    component.toggle(id2);
    expect(component.isExpanded(id1)).toBe(false);
    expect(component.isExpanded(id2)).toBe(true);
  });

  // ── Facilitator vs observer ───────────────────────────────────────────────

  it('shows footer CTA when facilitator', () => {
    component.isFacilitator = true;
    setSession();
    const footer = fixture.nativeElement.querySelector('.pr__footer');
    expect(footer).toBeTruthy();
    const observerEl = fixture.nativeElement.querySelector('.pr__observer');
    expect(observerEl).toBeNull();
  });

  it('shows observer state when not facilitator', () => {
    component.isFacilitator = false;
    setSession();
    const observer = fixture.nativeElement.querySelector('.pr__observer');
    expect(observer).toBeTruthy();
    const footer = fixture.nativeElement.querySelector('.pr__footer');
    expect(footer).toBeNull();
  });

  // ── Outputs ───────────────────────────────────────────────────────────────

  it('emits advance when CTA clicked by facilitator', () => {
    component.isFacilitator = true;
    component.advancing = false;
    setSession();
    let emitted = false;
    component.advance.subscribe(() => (emitted = true));
    const btn = fixture.debugElement.query(By.css('.pr__advance-btn'));
    btn.nativeElement.click();
    expect(emitted).toBeTrue();
  });

  it('emits back when Back button clicked by facilitator', () => {
    component.isFacilitator = true;
    component.advancing = false;
    setSession();
    let emitted = false;
    component.back.subscribe(() => (emitted = true));
    const btn = fixture.debugElement.query(By.css('.pr__back-btn'));
    btn.nativeElement.click();
    expect(emitted).toBeTrue();
  });

  it('advance button is disabled while advancing', () => {
    component.isFacilitator = true;
    component.advancing = true;
    setSession();
    const btn = fixture.nativeElement.querySelector(
      '.pr__advance-btn',
    ) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});
