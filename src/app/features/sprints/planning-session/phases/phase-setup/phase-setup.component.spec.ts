import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SimpleChange, SimpleChanges } from '@angular/core';
import { Timestamp } from '@firebase/firestore';
import { PhaseSetupComponent } from './phase-setup.component';
import { PlanningSessionV2 } from '../../../../../core/models/planning-session.model';

// ─── Factory ─────────────────────────────────────────────────────────────────

function makeSession(overrides: Partial<PlanningSessionV2> = {}): PlanningSessionV2 {
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
    phase: 'setup',
    currentReviewIndex: 0,
    facilitatorId: 'uid-facilitator',
    facilitatorName: 'Alice',
    participantIds: ['uid-facilitator', 'uid-bob'],
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
    createdBy: 'uid-facilitator',
    createdByName: 'Alice',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('PhaseSetupComponent', () => {
  let component: PhaseSetupComponent;
  let fixture: ComponentFixture<PhaseSetupComponent>;

  function setSession(overrides: Partial<PlanningSessionV2> = {}): void {
    const prev = component.session;
    component.session = makeSession(overrides);
    const changes: SimpleChanges = {
      session: new SimpleChange(prev, component.session, !prev),
    };
    component.ngOnChanges(changes);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        PhaseSetupComponent,
        MatIconModule,
        MatButtonModule,
        MatTooltipModule,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PhaseSetupComponent);
    component = fixture.componentInstance;
    component.session = makeSession();
    component.ngOnChanges({
      session: new SimpleChange(undefined, component.session, true),
    });
    fixture.detectChanges();
  });

  // ── formattedDateRange ─────────────────────────────────────────────────────

  describe('formattedDateRange', () => {
    it('formats a start+end range as "Mon D – Mon D"', () => {
      setSession({ sprintStartDate: '2026-04-01', sprintEndDate: '2026-04-14' });
      expect(component.formattedDateRange).toBe('Apr 1 – Apr 14');
    });

    it('shows "Starts Mon D" when only start date is set', () => {
      setSession({ sprintStartDate: '2026-04-01', sprintEndDate: null });
      expect(component.formattedDateRange).toContain('Starts');
      expect(component.formattedDateRange).toContain('Apr 1');
    });

    it('shows "Ends Mon D" when only end date is set', () => {
      setSession({ sprintStartDate: null, sprintEndDate: '2026-04-14' });
      expect(component.formattedDateRange).toContain('Ends');
      expect(component.formattedDateRange).toContain('Apr 14');
    });

    it('returns "Dates not set" when both dates are null', () => {
      setSession({ sprintStartDate: null, sprintEndDate: null });
      expect(component.formattedDateRange).toBe('Dates not set');
    });
  });

  // ── sprintDurationDays ─────────────────────────────────────────────────────

  describe('sprintDurationDays', () => {
    it('calculates the inclusive day count for a two-week sprint', () => {
      setSession({ sprintStartDate: '2026-04-01', sprintEndDate: '2026-04-14' });
      expect(component.sprintDurationDays).toBe(14);
    });

    it('returns 1 for a single-day sprint', () => {
      setSession({ sprintStartDate: '2026-04-01', sprintEndDate: '2026-04-01' });
      expect(component.sprintDurationDays).toBe(1);
    });

    it('returns 0 when start date is missing', () => {
      setSession({ sprintStartDate: null, sprintEndDate: '2026-04-14' });
      expect(component.sprintDurationDays).toBe(0);
    });

    it('returns 0 when end date is missing', () => {
      setSession({ sprintStartDate: '2026-04-01', sprintEndDate: null });
      expect(component.sprintDurationDays).toBe(0);
    });
  });

  // ── colorFor ──────────────────────────────────────────────────────────────

  describe('colorFor()', () => {
    it('returns an object with bg and text properties', () => {
      const color = component.colorFor(0);
      expect(color).toEqual(jasmine.objectContaining({ bg: jasmine.any(String), text: jasmine.any(String) }));
    });

    it('cycles through colors for indices beyond the palette length', () => {
      // Palette has 8 entries
      expect(component.colorFor(0)).toEqual(component.colorFor(8));
      expect(component.colorFor(1)).toEqual(component.colorFor(9));
    });

    it('returns distinct colors for adjacent indices', () => {
      expect(component.colorFor(0)).not.toEqual(component.colorFor(1));
    });
  });

  // ── initialsFor ───────────────────────────────────────────────────────────

  describe('initialsFor()', () => {
    it('produces two uppercase letters for a "First Last" name', () => {
      expect(component.initialsFor('Alice Smith')).toBe('AS');
    });

    it('uses only the first two words when name has three parts', () => {
      expect(component.initialsFor('John Paul Smith')).toBe('JP');
    });

    it('produces a single letter for a single-word name', () => {
      expect(component.initialsFor('Alice')).toBe('A');
    });

    it('uppercases the result', () => {
      expect(component.initialsFor('alice bob')).toBe('AB');
    });

    it('handles empty string without throwing', () => {
      expect(() => component.initialsFor('')).not.toThrow();
    });
  });

  // ── issueCountBySeverity ──────────────────────────────────────────────────

  describe('issueCountBySeverity signal', () => {
    it('counts issues with no estimate', () => {
      setSession({
        issueReviews: [
          {
            issueId: 'A', issueKey: 'A', title: 'A', storyPoints: 0,
            assignee: 'x', type: 'Story', priority: 'Med', status: 'To Do',
            statusCategory: 'new', outcome: null, notes: '', isCarryover: false,
            isSuspiciouslyLarge: false, hasNoEstimate: true, hasNoAssignee: false,
            reviewedAt: null, reviewedBy: null,
          },
        ],
      });
      expect(component.issueCountBySeverity().missing).toBe(1);
    });

    it('counts suspiciously large issues', () => {
      setSession({
        issueReviews: [
          {
            issueId: 'B', issueKey: 'B', title: 'B', storyPoints: 13,
            assignee: 'x', type: 'Story', priority: 'High', status: 'To Do',
            statusCategory: 'new', outcome: null, notes: '', isCarryover: false,
            isSuspiciouslyLarge: true, hasNoEstimate: false, hasNoAssignee: false,
            reviewedAt: null, reviewedBy: null,
          },
        ],
      });
      expect(component.issueCountBySeverity().large).toBe(1);
    });

    it('counts issues with no owner', () => {
      setSession({
        issueReviews: [
          {
            issueId: 'C', issueKey: 'C', title: 'C', storyPoints: 3,
            assignee: null, type: 'Story', priority: 'Med', status: 'To Do',
            statusCategory: 'new', outcome: null, notes: '', isCarryover: false,
            isSuspiciouslyLarge: false, hasNoEstimate: false, hasNoAssignee: true,
            reviewedAt: null, reviewedBy: null,
          },
        ],
      });
      expect(component.issueCountBySeverity().noOwner).toBe(1);
    });

    it('starts at zero when there are no issues', () => {
      setSession({ issueReviews: [] });
      const counts = component.issueCountBySeverity();
      expect(counts.missing).toBe(0);
      expect(counts.large).toBe(0);
      expect(counts.noOwner).toBe(0);
    });
  });

  // ── Outputs ───────────────────────────────────────────────────────────────

  describe('advance output', () => {
    it('emits when the "Begin Readiness Check" button is clicked by facilitator', () => {
      component.isFacilitator = true;
      component.advancing = false;
      fixture.detectChanges();

      let emitted = false;
      component.advance.subscribe(() => (emitted = true));

      const btn = fixture.debugElement.query(
        By.css('.setup__btn--primary'),
      );
      btn.nativeElement.click();
      expect(emitted).toBeTrue();
    });

    it('does not render the primary CTA when not a facilitator', () => {
      component.isFacilitator = false;
      fixture.detectChanges();

      const btn = fixture.debugElement.query(By.css('.setup__btn--primary'));
      expect(btn).toBeNull();
    });
  });

  describe('exit output', () => {
    it('emits when the "Back to Sprints" button is clicked', () => {
      let emitted = false;
      component.exit.subscribe(() => (emitted = true));

      const btn = fixture.debugElement.query(By.css('.setup__btn--ghost'));
      btn.nativeElement.click();
      expect(emitted).toBeTrue();
    });
  });

  // ── Sprint goal ───────────────────────────────────────────────────────────

  describe('sprint goal display', () => {
    it('shows the goal text when sprintGoal is set', () => {
      setSession({ sprintGoal: 'Ship the login flow' });
      const goalEl = fixture.debugElement.query(
        By.css('.setup__sprint-goal-text'),
      );
      expect(goalEl).not.toBeNull();
      expect(goalEl.nativeElement.textContent.trim()).toBe('Ship the login flow');
    });

    it('does not render the goal block when sprintGoal is null', () => {
      setSession({ sprintGoal: null });
      const goalEl = fixture.debugElement.query(By.css('.setup__sprint-goal'));
      expect(goalEl).toBeNull();
    });
  });

  // ── Participant grid ──────────────────────────────────────────────────────

  describe('participant grid', () => {
    it('renders one tile per participant', () => {
      setSession({
        participantNames: ['Alice', 'Bob', 'Carol'],
        participantIds: ['uid-a', 'uid-b', 'uid-c'],
        facilitatorId: 'uid-a',
      });
      const tiles = fixture.debugElement.queryAll(
        By.css('.setup__participant'),
      );
      expect(tiles.length).toBe(3);
    });

    it('marks the facilitator tile with the --facilitator modifier', () => {
      setSession({
        participantNames: ['Alice', 'Bob'],
        participantIds: ['uid-facilitator', 'uid-bob'],
        facilitatorId: 'uid-facilitator',
      });
      const facilitatorTile = fixture.debugElement.query(
        By.css('.setup__participant--facilitator'),
      );
      expect(facilitatorTile).not.toBeNull();
    });
  });
});
