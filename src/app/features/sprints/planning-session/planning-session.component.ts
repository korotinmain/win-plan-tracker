import { CommonModule, Location } from '@angular/common';
import {
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  IssueReview,
  PlanningPhase,
  PlanningSessionV2,
} from '../../../core/models/planning-session.model';
import { AuthService } from '../../../core/services/auth.service';
import { JiraSprint, JiraSprintIssue } from '../../../core/services/jira.service';
import { PlanningService } from '../../../core/services/planning.service';
import { PlanMemberOption } from '../participant-select-dialog/participant-select-dialog.component';
import { PhaseHeaderComponent } from './shared/phase-header/phase-header.component';
import { PhaseSetupComponent } from './phases/phase-setup/phase-setup.component';
import { PhaseReadinessComponent } from './phases/phase-readiness/phase-readiness.component';
import { PhaseContextComponent } from './phases/phase-context/phase-context.component';
import { PhaseReviewComponent } from './phases/phase-review/phase-review.component';
import { PhaseBalancingComponent } from './phases/phase-balancing/phase-balancing.component';
import { PhaseFinalReviewComponent } from './phases/phase-final-review/phase-final-review.component';
import { PhaseFinalizedComponent } from './phases/phase-finalized/phase-finalized.component';
import { ReadinessWarning, computeReadinessWarnings } from './phases/phase-readiness/readiness.util';

// ─── Phase ordering ──────────────────────────────────────────────────────────
const PHASE_ORDER: PlanningPhase[] = [
  'setup',
  'readiness',
  'context',
  'review',
  'balancing',
  'final-review',
  'finalized',
];

// ─── Navigation state interface ───────────────────────────────────────────────
interface NewSessionNavState {
  participants: PlanMemberOption[];
  sprint: JiraSprint;
}

// ─── Helper: convert Jira sprint issues into IssueReview[] ───────────────────
function buildIssueReviews(issues: JiraSprintIssue[]): IssueReview[] {
  return issues.map((issue) => ({
    issueId: issue.id,
    issueKey: issue.id,
    title: issue.title,
    storyPoints: issue.storyPoints ?? 0,
    assignee: issue.assignee,
    type: issue.type,
    priority: issue.priority,
    status: issue.status,
    statusCategory: issue.statusCategory,
    outcome: null,
    notes: '',
    isCarryover: false,
    isSuspiciouslyLarge: (issue.storyPoints ?? 0) >= 13,
    hasNoEstimate: issue.storyPoints == null || issue.storyPoints === 0,
    hasNoAssignee: issue.assignee == null,
    reviewedAt: null,
    reviewedBy: null,
  }));
}

// ─── Component ────────────────────────────────────────────────────────────────
@Component({
  selector: 'app-planning-session',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    PhaseHeaderComponent,
    PhaseSetupComponent,
    PhaseReadinessComponent,
    PhaseContextComponent,
    PhaseReviewComponent,
    PhaseBalancingComponent,
    PhaseFinalReviewComponent,
    PhaseFinalizedComponent,
  ],
  templateUrl: './planning-session.component.html',
  styleUrls: ['./planning-session.component.scss'],
})
export class PlanningSessionComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private planningService = inject(PlanningService);
  private auth = inject(AuthService);
  private snackBar = inject(MatSnackBar);

  // ── State ─────────────────────────────────────────────────────────────────
  readonly loading = signal(true);
  readonly creating = signal(false);
  readonly advancing = signal(false);
  readonly error = signal<string | null>(null);
  readonly session = signal<PlanningSessionV2 | null>(null);

  // ── Derived ───────────────────────────────────────────────────────────────
  readonly isFacilitator = computed(() => {
    const s = this.session();
    const uid = this.auth.currentUser?.uid;
    return !!s && !!uid && s.facilitatorId === uid;
  });

  readonly currentPhase = computed<PlanningPhase>(
    () => this.session()?.phase ?? 'setup',
  );

  private sessionSub?: Subscription;

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  async ngOnInit(): Promise<void> {
    // Priority 1: sessionId in route params → bookmarkable direct link
    const paramId = this.route.snapshot.paramMap.get('sessionId');
    if (paramId) {
      this.subscribeToSession(paramId);
      return;
    }

    // Priority 2: sessionId in navigation state → resume / view by ID
    const navState = this.getNavState();
    if (typeof navState?.['sessionId'] === 'string') {
      this.subscribeToSession(navState['sessionId'] as string);
      return;
    }

    // Priority 3: participants + sprint in navigation state → new session
    if (navState?.['participants'] && navState?.['sprint']) {
      await this.createAndSubscribe(navState as unknown as NewSessionNavState);
      return;
    }

    // No valid entry — redirect
    this.router.navigate(['/sprints']);
  }

  ngOnDestroy(): void {
    this.sessionSub?.unsubscribe();
  }

  // ── Session creation ──────────────────────────────────────────────────────
  private async createAndSubscribe(state: NewSessionNavState): Promise<void> {
    const user = this.auth.currentUser;
    if (!user?.teamId) {
      this.snackBar.open('You are not part of a team.', 'Dismiss', {
        duration: 4000,
      });
      this.router.navigate(['/sprints']);
      return;
    }

    this.creating.set(true);
    try {
      const id = await this.planningService.createSessionV2({
        sprintId: state.sprint.id,
        sprintName: state.sprint.name,
        sprintGoal: state.sprint.goal,
        sprintStartDate: state.sprint.startDate ?? null,
        sprintEndDate: state.sprint.endDate ?? null,
        participantIds: state.participants
          .map((p) => p.uid ?? '')
          .filter(Boolean),
        participantNames: state.participants.map((p) => p.name),
        issueReviews: buildIssueReviews(state.sprint.issues),
      });

      // Update URL to the bookmarkable canonical form (no component re-init)
      this.location.replaceState(`/sprints/planning/${id}`);
      this.subscribeToSession(id);
    } catch {
      this.error.set('Failed to create planning session. Please try again.');
      this.loading.set(false);
    } finally {
      this.creating.set(false);
    }
  }

  // ── Firestore live subscription ───────────────────────────────────────────
  private subscribeToSession(sessionId: string): void {
    this.sessionSub?.unsubscribe();
    this.sessionSub = this.planningService
      .liveSessionV2$(sessionId)
      .subscribe({
        next: (doc) => {
          if (!doc) {
            this.error.set('Session not found.');
            this.loading.set(false);
            return;
          }

          if ((doc as { schemaVersion?: unknown }).schemaVersion !== 2) {
            this.error.set(
              'This session was created with an older version of the planning tool. Please start a new session.',
            );
            this.loading.set(false);
            return;
          }

          this.session.set(doc);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Failed to load planning session.');
          this.loading.set(false);
        },
      });
  }

  // ── Phase navigation ──────────────────────────────────────────────────────
  async advance(): Promise<void> {
    const s = this.session();
    if (!s?.id || !this.isFacilitator()) return;

    const idx = PHASE_ORDER.indexOf(s.phase);
    if (idx < 0 || idx >= PHASE_ORDER.length - 1) return;

    this.advancing.set(true);
    try {
      await this.planningService.advancePhase(s.id, PHASE_ORDER[idx + 1]);
    } finally {
      this.advancing.set(false);
    }
  }

  async advanceFromReadiness(): Promise<void> {
    const s = this.session();
    if (!s?.id || !this.isFacilitator()) return;

    const warnings: ReadinessWarning[] = computeReadinessWarnings(s.issueReviews);
    const warningTitles = warnings.map((w) => w.title);

    this.advancing.set(true);
    try {
      await this.planningService.advancePhase(s.id, 'context', {
        readinessWarnings: warningTitles,
      });
    } finally {
      this.advancing.set(false);
    }
  }

  async prevPhase(): Promise<void> {
    const s = this.session();
    if (!s?.id || !this.isFacilitator()) return;

    const idx = PHASE_ORDER.indexOf(s.phase);
    if (idx <= 0) return;

    await this.planningService.advancePhase(s.id, PHASE_ORDER[idx - 1]);
  }

  goBack(): void {
    this.router.navigate(['/sprints']);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  private getNavState(): Record<string, unknown> | undefined {
    return this.router.lastSuccessfulNavigation?.extras?.state as
      | Record<string, unknown>
      | undefined;
  }
}
