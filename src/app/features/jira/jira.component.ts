import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { JiraService, JiraSprint } from '../../core/services/jira.service';
import {
  PlanningService,
  PlanningSession,
} from '../../core/services/planning.service';
import {
  ParticipantSelectDialogComponent,
  PlanMemberOption,
} from '../sprints/participant-select-dialog/participant-select-dialog.component';
import { AuthService } from '../../core/services/auth.service';
import { TeamService } from '../../core/services/team.service';

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
  private snackBar = inject(MatSnackBar);
  private router = inject(Router);
  private dialog = inject(MatDialog);
  private planningService = inject(PlanningService);
  private authService = inject(AuthService);
  private teamService = inject(TeamService);

  readonly BOARD_ID = '1671';

  connecting = signal(false);
  loadingSprints = signal(false);
  configured = signal<boolean | null>(null);
  configuredDomain = signal<string | null>(null);

  sprints = signal<JiraSprint[]>([]);

  // ── Planning history ──────────────────────────────────────────────────────
  planningHistory = signal<PlanningSession[]>([]);
  loadingHistory = signal(false);

  sprintStats = computed(() => {
    const active = this.sprints().find((s) => s.state === 'active');
    const issues = active?.issues ?? [];
    return {
      total: issues.length,
      inProgress: issues.filter(
        (i) =>
          i.statusCategory === 'in-progress' || i.statusCategory === 'yellow',
      ).length,
      done: issues.filter(
        (i) => i.statusCategory === 'done' || i.statusCategory === 'green',
      ).length,
      todo: issues.filter(
        (i) => i.statusCategory === 'new' || i.statusCategory === 'blue-gray',
      ).length,
    };
  });

  async ngOnInit(): Promise<void> {
    await this.checkConfig();
    this.loadHistory();
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
    } catch (error) {
      const message =
        (error as { message?: string })?.message ??
        'Unable to load Jira sprints.';
      this.snackBar.open(message, 'Dismiss', { duration: 6000 });
    } finally {
      this.loadingSprints.set(false);
    }
  }

  async refresh(): Promise<void> {
    await this.loadSprints();
  }

  async loadHistory(): Promise<void> {
    this.loadingHistory.set(true);
    try {
      const sessions = await this.planningService.getSessions();
      this.planningHistory.set(sessions);
    } catch {
      // silently fail — history is non-critical
    } finally {
      this.loadingHistory.set(false);
    }
  }

  async goToPlanning(): Promise<void> {
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
        .filter((u) => u?.displayName)
        .map((u) => ({
          name: u.displayName,
          initials: u.displayName
            .split(' ')
            .slice(0, 2)
            .map((w) => w[0] ?? '')
            .join('')
            .toUpperCase(),
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

    const sprintName =
      this.sprints().find((s) => s.state === 'future')?.name ??
      this.sprints().find((s) => s.state === 'active')?.name ??
      'Sprint Planning';

    const ref = this.dialog.open(ParticipantSelectDialogComponent, {
      panelClass: 'psd-panel',
      backdropClass: 'psd-backdrop',
      maxWidth: '95vw',
      data: { members, sprintName },
    });

    ref.afterClosed().subscribe((selected: PlanMemberOption[] | null) => {
      if (!selected?.length) return;
      this.router.navigate(['/sprints/planning'], {
        state: { participants: selected },
      });
    });
  }

  priorityIcon(priority: string): string {
    const map: Record<string, string> = {
      Highest: 'keyboard_double_arrow_up',
      High: 'keyboard_arrow_up',
      Medium: 'drag_handle',
      Low: 'keyboard_arrow_down',
      Lowest: 'keyboard_double_arrow_down',
    };
    return map[priority] ?? 'drag_handle';
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

  sprintProgress(sprint: JiraSprint): number {
    if (!sprint.stats.total) return 0;
    return Math.round((sprint.stats.done / sprint.stats.total) * 100);
  }
}
