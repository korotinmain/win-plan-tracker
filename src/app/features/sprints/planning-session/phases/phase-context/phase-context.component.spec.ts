import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatButtonModule } from '@angular/material/button';
import { SimpleChange } from '@angular/core';
import { Timestamp } from '@firebase/firestore';
import { PhaseContextComponent } from './phase-context.component';
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
    sprintGoal: 'Ship the feature',
    sprintStartDate: '2026-04-01',
    sprintEndDate: '2026-04-14',
    teamId: 'team-1',
    status: 'draft',
    phase: 'context',
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

describe('PhaseContextComponent', () => {
  let component: PhaseContextComponent;
  let fixture: ComponentFixture<PhaseContextComponent>;

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
      imports: [PhaseContextComponent, NoopAnimationsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(PhaseContextComponent);
    component = fixture.componentInstance;
    component.isFacilitator = false;
    component.advancing = false;
  });

  it('renders without error', () => {
    setSession();
    expect(component).toBeTruthy();
  });

  // ── Sprint name ───────────────────────────────────────────────────────────

  it('displays the sprint name', () => {
    setSession({ sprintName: 'Q2 Sprint 1' });
    const nameEl: HTMLElement =
      fixture.nativeElement.querySelector('.pc__sprint-name');
    expect(nameEl.textContent?.trim()).toBe('Q2 Sprint 1');
  });

  it('displays the sprint goal when present', () => {
    setSession({ sprintGoal: 'Deliver onboarding flow' });
    const goalEl: HTMLElement =
      fixture.nativeElement.querySelector('.pc__goal');
    expect(goalEl.textContent?.trim()).toBe('Deliver onboarding flow');
  });

  it('does not show goal element when goal is null', () => {
    setSession({ sprintGoal: null });
    const goalEl = fixture.nativeElement.querySelector('.pc__goal');
    expect(goalEl).toBeNull();
  });

  // ── Stats ─────────────────────────────────────────────────────────────────

  it('computes total issues and SP from issueReviews', () => {
    setSession({
      issueReviews: [
        makeReview({ issueId: 'A', storyPoints: 3 }),
        makeReview({ issueId: 'B', storyPoints: 8 }),
      ],
    });
    expect(component.totalIssues()).toBe(2);
    expect(component.totalSP()).toBe(11);
  });

  it('handles zero storyPoints gracefully', () => {
    setSession({
      issueReviews: [makeReview({ issueId: 'A', storyPoints: 0 })],
    });
    expect(component.totalSP()).toBe(0);
  });

  it('shows zero stats when no issues', () => {
    setSession({ issueReviews: [] });
    expect(component.totalIssues()).toBe(0);
    expect(component.totalSP()).toBe(0);
  });

  // ── Issue type breakdown ──────────────────────────────────────────────────

  it('groups issues by type', () => {
    setSession({
      issueReviews: [
        makeReview({ issueId: 'S1', type: 'Story' }),
        makeReview({ issueId: 'S2', type: 'Story' }),
        makeReview({ issueId: 'B1', type: 'Bug' }),
      ],
    });
    const storyEntry = component.typeStats().find((s) => s.type === 'Story');
    const bugEntry = component.typeStats().find((s) => s.type === 'Bug');
    expect(storyEntry?.count).toBe(2);
    expect(bugEntry?.count).toBe(1);
  });

  it('sums SP per type correctly', () => {
    setSession({
      issueReviews: [
        makeReview({ issueId: 'S1', type: 'Story', storyPoints: 3 }),
        makeReview({ issueId: 'S2', type: 'Story', storyPoints: 5 }),
        makeReview({ issueId: 'B1', type: 'Bug', storyPoints: 2 }),
      ],
    });
    const storyEntry = component.typeStats().find((s) => s.type === 'Story')!;
    expect(storyEntry.sp).toBe(8);
  });

  it('sorts type stats by count descending', () => {
    setSession({
      issueReviews: [
        makeReview({ issueId: 'B1', type: 'Bug' }),
        makeReview({ issueId: 'S1', type: 'Story' }),
        makeReview({ issueId: 'S2', type: 'Story' }),
        makeReview({ issueId: 'S3', type: 'Story' }),
      ],
    });
    const first = component.typeStats()[0];
    expect(first.type).toBe('Story');
    expect(first.count).toBe(3);
  });

  // ── Working days ─────────────────────────────────────────────────────────

  it('computes working days from start/end dates', () => {
    setSession({
      sprintStartDate: '2026-04-06',  // Monday
      sprintEndDate: '2026-04-10',    // Friday → 4 business days
    });
    // 4 working days between Mon and Fri
    expect(component.workingDays()).toBe(4);
  });

  it('sets working days to null when dates are missing', () => {
    setSession({ sprintStartDate: null, sprintEndDate: null });
    expect(component.workingDays()).toBeNull();
  });

  it('sets working days to null when only start date is present', () => {
    setSession({ sprintStartDate: '2026-04-06', sprintEndDate: null });
    expect(component.workingDays()).toBeNull();
  });

  // ── Date range display ────────────────────────────────────────────────────

  it('returns formatted date range string when both dates present', () => {
    setSession({
      sprintStartDate: '2026-04-01',
      sprintEndDate: '2026-04-14',
    });
    const range = component.sprintDateRange;
    expect(range).toContain('Apr 1');
    expect(range).toContain('Apr 14');
  });

  it('returns fallback when both dates are null', () => {
    setSession({ sprintStartDate: null, sprintEndDate: null });
    expect(component.sprintDateRange).toBe('Dates not set');
  });

  // ── Type icons ────────────────────────────────────────────────────────────

  it('returns bug_report icon for bug type', () => {
    expect(component.getTypeIcon('Bug')).toBe('bug_report');
  });

  it('returns bookmark icon for story type', () => {
    expect(component.getTypeIcon('Story')).toBe('bookmark');
  });

  it('returns task_alt icon for task type', () => {
    expect(component.getTypeIcon('Task')).toBe('task_alt');
  });

  it('returns circle as fallback for unknown type', () => {
    expect(component.getTypeIcon('Unknown XYZ')).toBe('circle');
  });

  // ── Participants ──────────────────────────────────────────────────────────

  it('renders an avatar for each participant', () => {
    setSession({ participantNames: ['Alice', 'Bob', 'Carol'] });
    const avatars = fixture.nativeElement.querySelectorAll('.pc__avatar');
    expect(avatars.length).toBe(3);
  });

  it('shows each participant initial in avatar', () => {
    setSession({ participantNames: ['Alice'] });
    const avatar: HTMLElement =
      fixture.nativeElement.querySelector('.pc__avatar');
    expect(avatar.textContent?.trim()).toBe('A');
  });

  // ── Facilitator vs observer ───────────────────────────────────────────────

  it('shows footer CTA when facilitator', () => {
    component.isFacilitator = true;
    setSession();
    const footer = fixture.nativeElement.querySelector('.pc__footer');
    expect(footer).toBeTruthy();
    const observer = fixture.nativeElement.querySelector('.pc__observer');
    expect(observer).toBeNull();
  });

  it('shows observer state when not facilitator', () => {
    component.isFacilitator = false;
    setSession();
    const observer = fixture.nativeElement.querySelector('.pc__observer');
    expect(observer).toBeTruthy();
    const footer = fixture.nativeElement.querySelector('.pc__footer');
    expect(footer).toBeNull();
  });

  // ── Outputs ───────────────────────────────────────────────────────────────

  it('emits advance when CTA clicked by facilitator', () => {
    component.isFacilitator = true;
    component.advancing = false;
    setSession();
    let emitted = false;
    component.advance.subscribe(() => (emitted = true));
    const btn = fixture.debugElement.query(By.css('.pc__advance-btn'));
    btn.nativeElement.click();
    expect(emitted).toBeTrue();
  });

  it('emits back when Back button clicked by facilitator', () => {
    component.isFacilitator = true;
    component.advancing = false;
    setSession();
    let emitted = false;
    component.back.subscribe(() => (emitted = true));
    const btn = fixture.debugElement.query(By.css('.pc__back-btn'));
    btn.nativeElement.click();
    expect(emitted).toBeTrue();
  });

  it('advance button is disabled while advancing', () => {
    component.isFacilitator = true;
    component.advancing = true;
    setSession();
    const btn = fixture.nativeElement.querySelector(
      '.pc__advance-btn',
    ) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});
