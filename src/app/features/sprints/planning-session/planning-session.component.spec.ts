import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick,
} from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { Location } from '@angular/common';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { of, Subject } from 'rxjs';
import { Timestamp } from '@firebase/firestore';

import { PlanningSessionComponent } from './planning-session.component';
import { PlanningService } from '../../../core/services/planning.service';
import { AuthService } from '../../../core/services/auth.service';
import {
  PlanningSessionV2,
  PlanningPhase,
} from '../../../core/models/planning-session.model';

// ─── Factories ────────────────────────────────────────────────────────────────

function makeSession(overrides: Partial<PlanningSessionV2> = {}): PlanningSessionV2 {
  const now = Timestamp.now();
  return {
    schemaVersion: 2,
    id: 'session-1',
    sprintId: 1,
    sprintName: 'Sprint 1',
    sprintGoal: null,
    sprintStartDate: '2026-04-01',
    sprintEndDate: '2026-04-14',
    teamId: 'team-1',
    status: 'draft',
    phase: 'setup',
    currentReviewIndex: 0,
    facilitatorId: 'uid-facilitator',
    facilitatorName: 'Alice',
    participantIds: ['uid-facilitator'],
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
    createdBy: 'uid-facilitator',
    createdByName: 'Alice',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createPlanningServiceSpy(session: PlanningSessionV2 | null = null): jasmine.SpyObj<PlanningService> {
  const spy = jasmine.createSpyObj<PlanningService>('PlanningService', [
    'liveSessionV2$',
    'createSessionV2',
    'advancePhase',
  ]);
  spy.liveSessionV2$.and.returnValue(of(session));
  spy.createSessionV2.and.resolveTo('session-new');
  spy.advancePhase.and.resolveTo(undefined);
  return spy;
}

function createAuthServiceSpy(
  uid = 'uid-facilitator',
  teamId = 'team-1',
): jasmine.SpyObj<AuthService> {
  const spy = jasmine.createSpyObj<AuthService>('AuthService', [], {
    currentUser: { uid, teamId, email: 'alice@test.com', displayName: 'Alice', role: 'manager', createdAt: new Date() } as never,
  });
  return spy;
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('PlanningSessionComponent', () => {
  let component: PlanningSessionComponent;
  let fixture: ComponentFixture<PlanningSessionComponent>;
  let routerSpy: jasmine.SpyObj<Router>;
  let locationSpy: jasmine.SpyObj<Location>;
  let planningServiceSpy: jasmine.SpyObj<PlanningService>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;

  async function setup(options: {
    paramId?: string;
    session?: PlanningSessionV2 | null;
    navState?: Record<string, unknown>;
    uid?: string;
  } = {}): Promise<void> {
    const session = options.session !== undefined ? options.session : makeSession();

    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);
    Object.defineProperty(routerSpy, 'lastSuccessfulNavigation', {
      get: () =>
        options.navState
          ? ({ extras: { state: options.navState } } as never)
          : null,
    });

    locationSpy = jasmine.createSpyObj<Location>('Location', ['replaceState']);
    planningServiceSpy = createPlanningServiceSpy(session);
    authServiceSpy = createAuthServiceSpy(options.uid ?? 'uid-facilitator');

    await TestBed.configureTestingModule({
      imports: [
        PlanningSessionComponent,
        MatIconModule,
        MatButtonModule,
        MatSnackBarModule,
      ],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap(
                options.paramId ? { sessionId: options.paramId } : {},
              ),
            },
          },
        },
        { provide: Router, useValue: routerSpy },
        { provide: Location, useValue: locationSpy },
        { provide: PlanningService, useValue: planningServiceSpy },
        { provide: AuthService, useValue: authServiceSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PlanningSessionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  }

  // ── Loading via route param ───────────────────────────────────────────────

  describe('session loading via route param', () => {
    it('subscribes to the session and clears loading state', fakeAsync(async () => {
      await setup({ paramId: 'session-1' });
      tick();
      expect(planningServiceSpy.liveSessionV2$).toHaveBeenCalledWith('session-1');
      expect(component.loading()).toBeFalse();
    }));

    it('sets the session from the live stream', fakeAsync(async () => {
      const session = makeSession({ sprintName: 'Sprint X' });
      await setup({ paramId: 'session-1', session });
      tick();
      expect(component.session()?.sprintName).toBe('Sprint X');
    }));

    it('shows an error when the session stream emits null', fakeAsync(async () => {
      await setup({ paramId: 'session-404', session: null });
      tick();
      expect(component.error()).toBeTruthy();
      expect(component.loading()).toBeFalse();
    }));

    it('shows an error when the session is v1 (no schemaVersion)', fakeAsync(async () => {
      const legacySession = { id: 'old', sprintName: 'Old Sprint' } as never;
      await setup({ paramId: 'old-1', session: legacySession });
      tick();
      expect(component.error()).toBeTruthy();
    }));
  });

  // ── Redirect when no entry state ─────────────────────────────────────────

  describe('redirect when no valid entry state', () => {
    it('navigates to /sprints when no param and no nav state', fakeAsync(async () => {
      await setup({ paramId: undefined, navState: undefined });
      tick();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/sprints']);
    }));
  });

  // ── isFacilitator ─────────────────────────────────────────────────────────

  describe('isFacilitator', () => {
    it('returns true when the current user is the facilitator', fakeAsync(async () => {
      await setup({ paramId: 'session-1', uid: 'uid-facilitator' });
      tick();
      expect(component.isFacilitator()).toBeTrue();
    }));

    it('returns false when the current user is not the facilitator', fakeAsync(async () => {
      await setup({ paramId: 'session-1', uid: 'uid-other' });
      tick();
      expect(component.isFacilitator()).toBeFalse();
    }));

    it('returns false when the session is not loaded', fakeAsync(async () => {
      await setup({ paramId: 'none', session: null });
      tick();
      expect(component.isFacilitator()).toBeFalse();
    }));
  });

  // ── currentPhase ──────────────────────────────────────────────────────────

  describe('currentPhase', () => {
    it('reflects the phase from the live session', fakeAsync(async () => {
      const session = makeSession({ phase: 'review' });
      await setup({ paramId: 'session-1', session });
      tick();
      expect(component.currentPhase()).toBe('review');
    }));

    it('defaults to "setup" before the session loads', async () => {
      // Create the component but do not call ngOnInit yet
      const spy = createPlanningServiceSpy(null);
      spy.liveSessionV2$.and.returnValue(new Subject()); // never emits

      await TestBed.configureTestingModule({
        imports: [PlanningSessionComponent, MatIconModule, MatButtonModule, MatSnackBarModule],
        providers: [
          { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ sessionId: 'x' }) } } },
          { provide: Router, useValue: jasmine.createSpyObj('Router', ['navigate']) },
          { provide: Location, useValue: jasmine.createSpyObj('Location', ['replaceState']) },
          { provide: PlanningService, useValue: spy },
          { provide: AuthService, useValue: createAuthServiceSpy() },
        ],
      }).compileComponents();

      const f = TestBed.createComponent(PlanningSessionComponent);
      expect(f.componentInstance.currentPhase()).toBe('setup');
    });
  });

  // ── advance ───────────────────────────────────────────────────────────────

  describe('advance()', () => {
    it('calls advancePhase with the next phase', fakeAsync(async () => {
      const session = makeSession({ phase: 'setup' });
      await setup({ paramId: 'session-1', session, uid: 'uid-facilitator' });
      tick();

      await component.advance();
      expect(planningServiceSpy.advancePhase).toHaveBeenCalledWith(
        'session-1',
        'readiness',
      );
    }));

    it('does not call advancePhase when not the facilitator', fakeAsync(async () => {
      const session = makeSession({ phase: 'setup' });
      await setup({ paramId: 'session-1', session, uid: 'uid-other' });
      tick();

      await component.advance();
      expect(planningServiceSpy.advancePhase).not.toHaveBeenCalled();
    }));

    it('does not advance past the last phase', fakeAsync(async () => {
      const session = makeSession({ phase: 'finalized' });
      await setup({ paramId: 'session-1', session, uid: 'uid-facilitator' });
      tick();

      await component.advance();
      expect(planningServiceSpy.advancePhase).not.toHaveBeenCalled();
    }));
  });

  // ── prevPhase ─────────────────────────────────────────────────────────────

  describe('prevPhase()', () => {
    it('calls advancePhase with the previous phase', fakeAsync(async () => {
      const session = makeSession({ phase: 'readiness' });
      await setup({ paramId: 'session-1', session, uid: 'uid-facilitator' });
      tick();

      await component.prevPhase();
      expect(planningServiceSpy.advancePhase).toHaveBeenCalledWith(
        'session-1',
        'setup',
      );
    }));

    it('does not go before the first phase', fakeAsync(async () => {
      const session = makeSession({ phase: 'setup' });
      await setup({ paramId: 'session-1', session, uid: 'uid-facilitator' });
      tick();

      await component.prevPhase();
      expect(planningServiceSpy.advancePhase).not.toHaveBeenCalled();
    }));
  });

  // ── goBack ────────────────────────────────────────────────────────────────

  describe('goBack()', () => {
    it('navigates to /sprints', fakeAsync(async () => {
      await setup({ paramId: 'session-1' });
      tick();
      component.goBack();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/sprints']);
    }));
  });
});
