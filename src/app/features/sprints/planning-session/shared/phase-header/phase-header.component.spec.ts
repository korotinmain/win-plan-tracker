import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MatIconModule } from '@angular/material/icon';
import { PHASE_CONFIGS, PhaseHeaderComponent } from './phase-header.component';
import { PlanningPhase } from '../../../../../core/models/planning-session.model';

describe('PhaseHeaderComponent', () => {
  let component: PhaseHeaderComponent;
  let fixture: ComponentFixture<PhaseHeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PhaseHeaderComponent, MatIconModule],
    }).compileComponents();

    fixture = TestBed.createComponent(PhaseHeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // ── getState ────────────────────────────────────────────────────────────────

  describe('getState()', () => {
    it('returns "active" for the current phase', () => {
      component.currentPhase = 'setup';
      const setupConfig = PHASE_CONFIGS.find((p) => p.phase === 'setup')!;
      expect(component.getState(setupConfig)).toBe('active');
    });

    it('returns "done" for a phase before the current one', () => {
      component.currentPhase = 'context';
      const setupConfig = PHASE_CONFIGS.find((p) => p.phase === 'setup')!;
      expect(component.getState(setupConfig)).toBe('done');
    });

    it('returns "upcoming" for a phase after the current one', () => {
      component.currentPhase = 'setup';
      const reviewConfig = PHASE_CONFIGS.find((p) => p.phase === 'review')!;
      expect(component.getState(reviewConfig)).toBe('upcoming');
    });

    it('marks all previous phases as "done" when at the last phase', () => {
      component.currentPhase = 'finalized';
      const states = PHASE_CONFIGS.slice(0, -1).map((p) => component.getState(p));
      expect(states.every((s) => s === 'done')).toBeTrue();
    });

    it('marks all subsequent phases as "upcoming" when at the first phase', () => {
      component.currentPhase = 'setup';
      const states = PHASE_CONFIGS.slice(1).map((p) => component.getState(p));
      expect(states.every((s) => s === 'upcoming')).toBeTrue();
    });
  });

  // ── currentIndex ────────────────────────────────────────────────────────────

  describe('currentIndex', () => {
    it('returns 0 for "setup"', () => {
      component.currentPhase = 'setup';
      expect(component.currentIndex).toBe(0);
    });

    it('returns 3 for "review"', () => {
      component.currentPhase = 'review';
      expect(component.currentIndex).toBe(3);
    });

    it('returns the last index for "finalized"', () => {
      component.currentPhase = 'finalized';
      expect(component.currentIndex).toBe(PHASE_CONFIGS.length - 1);
    });
  });

  // ── currentConfig ───────────────────────────────────────────────────────────

  describe('currentConfig', () => {
    it('returns the correct config for the active phase', () => {
      component.currentPhase = 'balancing';
      expect(component.currentConfig.phase).toBe('balancing');
      expect(component.currentConfig.label).toBe('Balance');
    });

    it('returns a valid config for every defined phase', () => {
      const phases: PlanningPhase[] = [
        'setup', 'readiness', 'context', 'review', 'balancing', 'final-review', 'finalized',
      ];
      for (const phase of phases) {
        component.currentPhase = phase;
        expect(component.currentConfig.phase).toBe(phase);
      }
    });
  });

  // ── DOM ─────────────────────────────────────────────────────────────────────

  describe('template', () => {
    it('renders one step node per phase', () => {
      component.currentPhase = 'setup';
      fixture.detectChanges();
      const steps = fixture.debugElement.queryAll(By.css('.phase-header__step'));
      expect(steps.length).toBe(PHASE_CONFIGS.length);
    });

    it('applies --active class only to the current phase node', () => {
      component.currentPhase = 'review';
      fixture.detectChanges();
      const activeSteps = fixture.debugElement.queryAll(
        By.css('.phase-header__step--active'),
      );
      expect(activeSteps.length).toBe(1);
    });

    it('compact indicator shows current phase label', () => {
      component.currentPhase = 'balancing';
      fixture.detectChanges();
      const label = fixture.debugElement.query(
        By.css('.phase-header__compact-label'),
      );
      expect(label.nativeElement.textContent.trim()).toBe('Balance');
    });

    it('compact indicator shows correct step count', () => {
      component.currentPhase = 'review'; // index 3 → Step 4
      fixture.detectChanges();
      const count = fixture.debugElement.query(
        By.css('.phase-header__compact-count'),
      );
      expect(count.nativeElement.textContent.trim()).toBe(
        `Step 4 / ${PHASE_CONFIGS.length}`,
      );
    });
  });
});
