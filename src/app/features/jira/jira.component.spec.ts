import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { JiraSprint, JiraService } from '../../core/services/jira.service';
import {
  PlanningService,
  PlanningSession,
} from '../../core/services/planning.service';
import { TeamService } from '../../core/services/team.service';
import { JiraComponent } from './jira.component';

describe('JiraComponent', () => {
  let component: JiraComponent;
  let planningService: {
    getActiveDraftForSprint: jasmine.Spy;
    getCompletedForSprint: jasmine.Spy;
  };

  beforeEach(() => {
    planningService = {
      getActiveDraftForSprint: jasmine.createSpy('getActiveDraftForSprint'),
      getCompletedForSprint: jasmine.createSpy('getCompletedForSprint'),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: JiraService, useValue: {} },
        { provide: PlanningService, useValue: planningService },
        { provide: AuthService, useValue: { currentUser: { uid: 'user-1' } } },
        { provide: TeamService, useValue: {} },
        { provide: MatDialog, useValue: {} },
        { provide: Router, useValue: {} },
        { provide: MatSnackBar, useValue: {} },
      ],
    });

    component = TestBed.runInInjectionContext(() => new JiraComponent());
  });

  it('uses the legacy sprint-only planning lookup when the current user has no team id', async () => {
    const nextSprint = createFutureSprint('Sprint 42');
    const draftSession = { id: 'draft-1', status: 'draft' } as PlanningSession;
    const completedSession = {
      id: 'completed-1',
      status: 'completed',
    } as PlanningSession;

    component.sprints.set([nextSprint]);
    planningService.getActiveDraftForSprint.and.resolveTo(draftSession);
    planningService.getCompletedForSprint.and.resolveTo(completedSession);

    await component.checkPlanningState();

    expect(planningService.getActiveDraftForSprint.calls.allArgs()).toEqual([
      ['Sprint 42'],
    ]);
    expect(planningService.getCompletedForSprint.calls.allArgs()).toEqual([
      ['Sprint 42'],
    ]);
    expect(component.draftSession()).toBe(draftSession);
    expect(component.completedSession()).toBe(completedSession);
  });
});

function createFutureSprint(name: string): JiraSprint {
  return {
    id: 42,
    name,
    state: 'future',
    startDate: null,
    endDate: null,
    goal: null,
    issues: [],
    stats: { total: 0, done: 0 },
  };
}
