import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Timestamp } from '@firebase/firestore';
import { inject } from '@angular/core';
import {
  IssueOutcome,
  IssueReview,
  PlanningSessionV2,
} from '../../../../../core/models/planning-session.model';
import { PlanningService } from '../../../../../core/services/planning.service';
import { OutcomeBadgeComponent } from '../../shared/outcome-badge/outcome-badge.component';

const OUTCOME_GROUPS: { outcome: IssueOutcome; label: string; icon: string }[] = [
  { outcome: 'confirmed', label: 'Confirmed', icon: 'check_circle' },
  { outcome: 'risky-accepted', label: 'Risky – Accepted', icon: 'warning' },
  { outcome: 'reassigned', label: 'Reassigned', icon: 'swap_horiz' },
  { outcome: 'needs-clarification', label: 'Needs Clarification', icon: 'help' },
  { outcome: 'split-candidate', label: 'Split Candidate', icon: 'call_split' },
  { outcome: 'deferred', label: 'Deferred', icon: 'cancel' },
];

@Component({
  selector: 'app-phase-final-review',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    OutcomeBadgeComponent,
  ],
  templateUrl: './phase-final-review.component.html',
  styleUrls: ['./phase-final-review.component.scss'],
})
export class PhaseFinalReviewComponent implements OnChanges {
  @Input() session!: PlanningSessionV2;
  @Input() isFacilitator = false;
  @Input() advancing = false;

  @Output() advance = new EventEmitter<void>();
  @Output() back = new EventEmitter<void>();

  private planningService = inject(PlanningService);

  readonly OUTCOME_GROUPS = OUTCOME_GROUPS;

  readonly finalizing = signal(false);
  readonly grouped = signal<Map<IssueOutcome, IssueReview[]>>(new Map());

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['session'] && this.session) {
      this.buildGroups();
    }
  }

  private buildGroups(): void {
    const map = new Map<IssueOutcome, IssueReview[]>();
    for (const g of OUTCOME_GROUPS) {
      map.set(g.outcome, []);
    }
    for (const r of this.session.issueReviews ?? []) {
      if (r.outcome) {
        const list = map.get(r.outcome) ?? [];
        list.push(r);
        map.set(r.outcome, list);
      }
    }
    this.grouped.set(map);
  }

  groupFor(outcome: IssueOutcome): IssueReview[] {
    return this.grouped().get(outcome) ?? [];
  }

  get committedSP(): number {
    return (this.session.issueReviews ?? [])
      .filter((r) => r.outcome === 'confirmed' || r.outcome === 'risky-accepted')
      .reduce((s, r) => s + (r.storyPoints ?? 0), 0);
  }

  get confirmedCount(): number {
    return (this.session.issueReviews ?? []).filter((r) => r.outcome === 'confirmed').length;
  }

  get deferredCount(): number {
    return (this.session.issueReviews ?? []).filter((r) => r.outcome === 'deferred').length;
  }

  get totalReviewed(): number {
    return (this.session.issueReviews ?? []).filter((r) => r.outcome !== null).length;
  }

  async finalize(): Promise<void> {
    const s = this.session;
    if (!s?.id || !this.isFacilitator) return;
    this.finalizing.set(true);
    try {
      await this.planningService.finalizeSessionV2(
        s.id,
        s.issueReviews,
        s.capacityData,
      );
      this.advance.emit();
    } finally {
      this.finalizing.set(false);
    }
  }

  getTypeIcon(type: string): string {
    const t = (type ?? '').toLowerCase();
    if (t.includes('story')) return 'bookmark';
    if (t.includes('bug')) return 'bug_report';
    if (t.includes('task')) return 'task_alt';
    if (t.includes('epic')) return 'auto_awesome';
    return 'circle';
  }
}
