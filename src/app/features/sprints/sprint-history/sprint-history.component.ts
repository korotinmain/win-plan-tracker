import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import {
  PlanningSession,
  PlanningService,
} from '../../../core/services/planning.service';

type FilterStatus = 'all' | 'completed' | 'draft';

@Component({
  selector: 'app-sprint-history',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTooltipModule,
  ],
  templateUrl: './sprint-history.component.html',
  styleUrls: ['./sprint-history.component.scss'],
})
export class SprintHistoryComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly planningService = inject(PlanningService);
  private readonly snackBar = inject(MatSnackBar);

  // ── State ──────────────────────────────────────────────────────────────────
  readonly loading = signal(true);
  readonly sessions = signal<PlanningSession[]>([]);
  readonly filter = signal<FilterStatus>('all');

  // ── Derived ────────────────────────────────────────────────────────────────
  readonly filteredSessions = computed(() => {
    const f = this.filter();
    const all = this.sessions();
    if (f === 'all') return all;
    if (f === 'draft') return all.filter((s) => s.status === 'draft');
    return all.filter((s) => s.status === 'completed');
  });

  readonly completedSessions = computed(() =>
    this.sessions().filter((s) => s.status === 'completed'),
  );

  readonly draftCount = computed(
    () => this.sessions().length - this.completedSessions().length,
  );

  readonly velocityData = computed(() =>
    this.completedSessions()
      .slice(0, 10)
      .reverse()
      .map((s) => ({
        name: s.sprintName,
        sp: s.summary?.totalStoryPoints ?? (s as any).totalStoryPoints ?? 0,
      })),
  );

  readonly maxVelocity = computed(() => {
    const data = this.velocityData();
    return data.length ? Math.max(...data.map((v) => v.sp), 1) : 1;
  });

  readonly avgVelocity = computed(() => {
    const completed = this.completedSessions();
    if (!completed.length) return 0;
    return Math.round(
      completed.reduce(
        (acc, s) =>
          acc +
          (s.summary?.totalStoryPoints ?? (s as any).totalStoryPoints ?? 0),
        0,
      ) / completed.length,
    );
  });

  readonly totalSP = computed(() =>
    this.completedSessions().reduce(
      (acc, s) =>
        acc + (s.summary?.totalStoryPoints ?? (s as any).totalStoryPoints ?? 0),
      0,
    ),
  );

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  async ngOnInit(): Promise<void> {
    await this.load();
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const teamId = this.authService.currentUser?.teamId ?? '';
      this.sessions.set(await this.planningService.getSessionsForTeam(teamId));
    } catch {
      this.snackBar.open('Failed to load planning history.', 'Dismiss', {
        duration: 4000,
      });
    } finally {
      this.loading.set(false);
    }
  }

  openSession(session: PlanningSession): void {
    this.router.navigate(['/sprints/planning', session.id]);
  }

  goBack(): void {
    this.router.navigate(['/sprints']);
  }

  setFilter(f: FilterStatus): void {
    this.filter.set(f);
  }

  trackSession(_: number, session: PlanningSession): string {
    return session.id ?? session.sprintName;
  }

  participantCount(session: PlanningSession): number {
    return (
      (session as any).participants?.length ??
      session.participantIds?.length ??
      0
    );
  }

  plannedTasks(session: PlanningSession): number {
    return session.summary?.plannedTasks ?? (session as any).issueCount ?? 0;
  }

  spTotal(session: PlanningSession): number {
    return (
      session.summary?.totalStoryPoints ??
      (session as any).totalStoryPoints ??
      0
    );
  }
}
