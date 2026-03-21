import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import {
  PlanningService,
  PlanningSession,
} from '../../core/services/planning.service';
import { TeamService } from '../../core/services/team.service';
import { JiraService, JiraSprint } from '../../core/services/jira.service';
import {
  ParticipantSelectDialogComponent,
  PlanMemberOption,
} from '../sprints/participant-select-dialog/participant-select-dialog.component';

@Component({
  selector: 'app-jira',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatDialogModule,
  ],
  templateUrl: './jira.component.html',
  styleUrls: ['./jira.component.scss'],
})
export class JiraComponent implements OnInit {
  private jiraService = inject(JiraService);
  private planningService = inject(PlanningService);
  private authService = inject(AuthService);
  private teamService = inject(TeamService);
  private dialog = inject(MatDialog);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);

  readonly BOARD_ID = '1671';

  connecting = signal(false);
  loadingSprints = signal(false);
  loadingHistory = signal(false);
  checkingPlanningState = signal(false);
  configured = signal<boolean | null>(null);
  configuredDomain = signal<string | null>(null);
  sprints = signal<JiraSprint[]>([]);
  draftSession = signal<PlanningSession | null>(null);
  completedSession = signal<PlanningSession | null>(null);
  planningHistory = signal<PlanningSession[]>([]);

  readonly activeSprint = computed(
    () => this.sprints().find((s) => s.state === 'active') ?? null,
  );
  readonly nextSprint = computed(
    () => this.sprints().find((s) => s.state === 'future') ?? null,
  );
  readonly completedCount = computed(
    () => this.planningHistory().filter((s) => s.status === 'completed').length,
  );
  readonly draftCount = computed(
    () => this.planningHistory().filter((s) => s.status === 'draft').length,
  );
  readonly planningButtonState = computed<
    'start' | 'resume' | 'planned' | 'no-issues' | 'hidden'
  >(() => {
    const next = this.nextSprint();
    if (!next) return 'hidden';
    if (this.completedSession()) return 'planned';
    if (this.draftSession()) return 'resume';
    if (!next.issues.length) return 'no-issues';
    return 'start';
  });

  readonly activeStats = computed(() => {
    const sprint = this.activeSprint();
    const issues = sprint?.issues ?? [];
    return {
      total: issues.length,
      done: issues.filter(
        (i) => i.statusCategory === 'done' || i.statusCategory === 'green',
      ).length,
      inProgress: issues.filter(
        (i) =>
          i.statusCategory === 'in-progress' || i.statusCategory === 'yellow',
      ).length,
      todo: issues.filter(
        (i) => i.statusCategory === 'new' || i.statusCategory === 'blue-gray',
      ).length,
    };
  });

  async ngOnInit(): Promise<void> {
    await this.checkConfig();
    await this.loadHistory();
  }

  async checkConfig(): Promise<void> {
    this.connecting.set(true);
    try {
      const { configured, domain } = await this.jiraService.checkConfigured();
      this.configured.set(configured);
      this.configuredDomain.set(domain ?? null);
      if (configured) {
        await this.loadSprints();
      }
    } catch {
      this.configured.set(false);
    } finally {
      this.connecting.set(false);
    }
  }

  async loadSprints(): Promise<void> {
    this.loadingSprints.set(true);
    try {
      const sprints = await this.jiraService.fetchSprints(this.BOARD_ID);
      this.sprints.set(sprints);
      await this.checkPlanningState();
    } catch (error) {
      const message =
        (error as { message?: string })?.message ??
        'Unable to load Jira sprints.';
      this.snackBar.open(message, 'Dismiss', { duration: 5000 });
    } finally {
      this.loadingSprints.set(false);
    }
  }

  async loadHistory(): Promise<void> {
    this.loadingHistory.set(true);
    try {
      const teamId = this.authService.currentUser?.teamId;
      if (!teamId) {
        this.planningHistory.set([]);
        return;
      }

      this.planningHistory.set(
        await this.planningService.getSessionsForTeam(teamId),
      );
    } catch {
      this.snackBar.open('Failed to load planning history.', 'Dismiss', {
        duration: 4000,
      });
    } finally {
      this.loadingHistory.set(false);
    }
  }

  async refreshAll(): Promise<void> {
    await Promise.all([this.loadSprints(), this.loadHistory()]);
  }

  async checkPlanningState(): Promise<void> {
    const next = this.nextSprint();
    const teamId = this.authService.currentUser?.teamId;
    if (!next) {
      this.draftSession.set(null);
      this.completedSession.set(null);
      return;
    }
    if (!teamId) {
      this.draftSession.set(null);
      this.completedSession.set(null);
      return;
    }
    this.checkingPlanningState.set(true);
    try {
      const [draft, completed] = await Promise.all([
        this.planningService.getActiveDraftForSprint(teamId, next.name),
        this.planningService.getCompletedForSprint(teamId, next.name),
      ]);
      this.draftSession.set(draft);
      this.completedSession.set(completed);
    } finally {
      this.checkingPlanningState.set(false);
    }
  }

  async startPlanning(): Promise<void> {
    const state = this.planningButtonState();
    if (state === 'hidden' || state === 'no-issues') return;

    if (state === 'resume' && this.draftSession()) {
      const session = this.draftSession()!;
      this.router.navigate(['/sprints/planning'], {
        state: {
          sessionId: session.id,
          participants: (session.participants ?? []).map((name, index) => ({
            name,
            initials: this.initials(name),
            uid: session.participantIds?.[index],
          })),
        },
      });
      return;
    }

    if (state === 'planned' && this.completedSession()) {
      this.viewSession(this.completedSession()!);
      return;
    }

    const teamId = this.authService.currentUser?.teamId;
    if (!teamId) {
      this.snackBar.open('You are not part of a team yet.', 'Dismiss', {
        duration: 4000,
      });
      return;
    }

    let members: PlanMemberOption[] = [];
    try {
      const users = await this.teamService.getTeamMembers(teamId);
      members = users
        .filter((user) => user?.displayName)
        .map((user) => ({
          uid: user.uid,
          name: user.displayName,
          initials: this.initials(user.displayName),
        }));
    } catch {
      this.snackBar.open('Failed to load team members.', 'Dismiss', {
        duration: 4000,
      });
      return;
    }

    if (!members.length) {
      this.snackBar.open('No team members found.', 'Dismiss', {
        duration: 4000,
      });
      return;
    }

    const ref = this.dialog.open(ParticipantSelectDialogComponent, {
      panelClass: 'psd-panel',
      backdropClass: 'psd-backdrop',
      maxWidth: '95vw',
      data: {
        members,
        sprintName: this.nextSprint()?.name ?? 'Sprint Planning',
      },
    });

    ref.afterClosed().subscribe((selected: PlanMemberOption[] | null) => {
      if (!selected?.length) return;
      this.router.navigate(['/sprints/planning'], {
        state: { participants: selected },
      });
    });
  }

  viewSession(session: PlanningSession): void {
    this.router.navigate(['/sprints/planning'], {
      state: {
        sessionId: session.id,
        readOnly: session.status === 'completed',
      },
    });
  }

  sprintProgress(sprint: JiraSprint | null): number {
    if (!sprint?.stats.total) return 0;
    return Math.round((sprint.stats.done / sprint.stats.total) * 100);
  }

  daysRemaining(sprint: JiraSprint | null): number | null {
    if (!sprint?.endDate) return null;
    const diff = Math.ceil(
      (new Date(sprint.endDate).getTime() - Date.now()) / 86_400_000,
    );
    return diff >= 0 ? diff : 0;
  }

  typeIcon(type: string): string {
    const map: Record<string, string> = {
      Bug: 'bug_report',
      Story: 'auto_stories',
      Epic: 'flash_on',
      Task: 'task_alt',
      Subtask: 'check_circle_outline',
    };
    return map[type] ?? 'task_alt';
  }

  trackSession(_index: number, session: PlanningSession): string {
    return session.id ?? `${session.sprintName}-${session.createdAt}`;
  }

  private initials(name: string): string {
    return name
      .split(' ')
      .slice(0, 2)
      .map((part) => part[0] ?? '')
      .join('')
      .toUpperCase();
  }
}
