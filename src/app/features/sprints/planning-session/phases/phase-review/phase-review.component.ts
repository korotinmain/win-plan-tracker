import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Timestamp } from '@firebase/firestore';
import {
  IssueOutcome,
  IssueReview,
  PlanningSessionV2,
} from '../../../../../core/models/planning-session.model';
import { AuthService } from '../../../../../core/services/auth.service';
import { PlanningService } from '../../../../../core/services/planning.service';
import {
  OUTCOME_CONFIGS,
  OutcomeBadgeComponent,
} from '../../shared/outcome-badge/outcome-badge.component';

const OUTCOME_ORDER: IssueOutcome[] = [
  'confirmed',
  'reassigned',
  'risky-accepted',
  'needs-clarification',
  'deferred',
  'split-candidate',
];

const SP_PRESETS = [1, 2, 3, 5, 8, 13, 21];

@Component({
  selector: 'app-phase-review',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    OutcomeBadgeComponent,
  ],
  templateUrl: './phase-review.component.html',
  styleUrls: ['./phase-review.component.scss'],
})
export class PhaseReviewComponent implements OnChanges {
  @Input() session!: PlanningSessionV2;
  @Input() isFacilitator = false;
  @Input() advancing = false;

  @Output() advance = new EventEmitter<void>();
  @Output() back = new EventEmitter<void>();

  private planningService = inject(PlanningService);
  private auth = inject(AuthService);

  readonly OUTCOME_ORDER = OUTCOME_ORDER;
  readonly OUTCOME_CONFIGS = OUTCOME_CONFIGS;
  readonly SP_PRESETS = SP_PRESETS;

  // ── Local edit state (facilitator only) ────────────────────────────────────────────
  readonly localOutcome = signal<IssueOutcome | null>(null);
  readonly localNotes = signal('');
  readonly localPlannedSP = signal<number | null>(null);
  readonly saving = signal(false);
  readonly navigating = signal(false);
  readonly markingWeighed = signal(false);

  private lastSyncedIndex = -1;

  // ── Derived from session (plain getters — session is not a signal) ─────────
  get currentIndex(): number { return this.session?.currentReviewIndex ?? 0; }
  get totalIssues(): number { return this.session?.issueReviews?.length ?? 0; }

  get currentIssue(): IssueReview | null {
    return this.session?.issueReviews?.[this.currentIndex] ?? null;
  }

  get reviewedCount(): number {
    return (this.session?.issueReviews ?? []).filter((r) => r.outcome !== null).length;
  }

  get progressPct(): number {
    const total = this.totalIssues;
    return total === 0 ? 0 : Math.round((this.reviewedCount / total) * 100);
  }

  get allReviewed(): boolean {
    return this.totalIssues > 0 && this.reviewedCount === this.totalIssues;
  }

  get participantsWeighedIn(): string[] {
    const issue = this.currentIssue;
    if (!issue) return [];
    return this.session?.issueParticipation?.[issue.issueId] ?? [];
  }

  get hasCurrentUserWeighedIn(): boolean {
    const uid = this.auth.currentUser?.uid;
    return !!uid && this.participantsWeighedIn.includes(uid);
  }

  get isFirstIssue(): boolean { return this.currentIndex === 0; }
  get isLastIssue(): boolean { return this.currentIndex >= this.totalIssues - 1; }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['session'] && this.session) {
      const idx = this.currentIndex;
      if (idx !== this.lastSyncedIndex) {
        this.syncLocalState();
        this.lastSyncedIndex = idx;
      }
    }
  }

  private syncLocalState(): void {
    const issue = this.currentIssue;
    this.localOutcome.set(issue?.outcome ?? null);
    this.localNotes.set(issue?.notes ?? '');
    this.localPlannedSP.set(issue?.plannedStoryPoints ?? null);
  }

  // ── Facilitator actions ────────────────────────────────────────────────────

  async setOutcome(outcome: IssueOutcome): Promise<void> {
    if (!this.isFacilitator) return;
    // Toggle off if same outcome clicked again
    const next = this.localOutcome() === outcome ? null : outcome;
    this.localOutcome.set(next);
    await this.saveCurrentIssue(next, this.localNotes(), this.localPlannedSP());
  }

  onNotesChange(value: string): void {
    this.localNotes.set(value);
  }

  async saveNotes(): Promise<void> {
    if (!this.isFacilitator) return;
    await this.saveCurrentIssue(this.localOutcome(), this.localNotes(), this.localPlannedSP());
  }

  async setPlannedSP(val: number | null): Promise<void> {
    if (!this.isFacilitator) return;
    this.localPlannedSP.set(val);
    await this.saveCurrentIssue(this.localOutcome(), this.localNotes(), val);
  }

  private async saveCurrentIssue(
    outcome: IssueOutcome | null,
    notes: string,
    plannedStoryPoints: number | null,
  ): Promise<void> {
    if (!this.session?.id) return;
    const reviews = [...this.session.issueReviews];
    const idx = this.currentIndex;
    reviews[idx] = {
      ...reviews[idx],
      outcome,
      notes,
      plannedStoryPoints,
      reviewedAt: outcome ? Timestamp.now() : null,
      reviewedBy: outcome ? (this.auth.currentUser?.uid ?? null) : null,
    };
    this.saving.set(true);
    try {
      await this.planningService.updateIssueReviews(this.session.id, reviews);
    } finally {
      this.saving.set(false);
    }
  }

  async navNext(): Promise<void> {
    if (!this.session?.id || this.navigating()) return;
    const next = this.currentIndex + 1;
    if (next >= this.totalIssues) return;
    this.navigating.set(true);
    try {
      await this.planningService.setReviewIndex(this.session.id, next);
    } finally {
      this.navigating.set(false);
    }
    this.lastSyncedIndex = -1;
  }

  async navPrev(): Promise<void> {
    if (!this.session?.id || this.navigating()) return;
    const prev = this.currentIndex - 1;
    if (prev < 0) return;
    this.navigating.set(true);
    try {
      await this.planningService.setReviewIndex(this.session.id, prev);
    } finally {
      this.navigating.set(false);
    }
    this.lastSyncedIndex = -1;
  }

  // ── Participant action ─────────────────────────────────────────────────────

  async markWeighed(): Promise<void> {
    if (!this.session?.id || this.hasCurrentUserWeighedIn) return;
    const uid = this.auth.currentUser?.uid;
    const issue = this.currentIssue;
    if (!uid || !issue) return;
    this.markingWeighed.set(true);
    try {
      await this.planningService.markParticipantWeighed(
        this.session.id,
        issue.issueId,
        uid,
      );
    } finally {
      this.markingWeighed.set(false);
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  getTypeIcon(type: string): string {
    const t = (type ?? '').toLowerCase();
    if (t.includes('story')) return 'bookmark';
    if (t.includes('bug')) return 'bug_report';
    if (t.includes('task')) return 'task_alt';
    if (t.includes('epic')) return 'auto_awesome';
    if (t.includes('sub')) return 'subdirectory_arrow_right';
    return 'circle';
  }

  getPriorityIcon(priority: string): string {
    const p = (priority ?? '').toLowerCase();
    if (p.includes('critical') || p.includes('blocker')) return 'error';
    if (p.includes('high')) return 'keyboard_arrow_up';
    if (p.includes('low')) return 'keyboard_arrow_down';
    return 'drag_handle';
  }
}
