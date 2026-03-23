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
import {
  CapacityEntry,
  IssueReview,
  PlanningSessionV2,
  computeSessionSummary,
} from '../../../../../core/models/planning-session.model';
import { PlanningService } from '../../../../../core/services/planning.service';
import { inject } from '@angular/core';
import { OutcomeBadgeComponent } from '../../shared/outcome-badge/outcome-badge.component';
import { computeCapacity, maxPlannedSP } from './capacity.util';

interface LaneIssue {
  issueId: string;
  issueKey: string;
  title: string;
  storyPoints: number;
  outcome: IssueReview['outcome'];
  type: string;
}

interface PersonLane {
  uid: string;
  name: string;
  plannedSP: number;
  availableSP: number;
  isOverloaded: boolean;
  issues: LaneIssue[];
  barPct: number;
}

@Component({
  selector: 'app-phase-balancing',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    OutcomeBadgeComponent,
  ],
  templateUrl: './phase-balancing.component.html',
  styleUrls: ['./phase-balancing.component.scss'],
})
export class PhaseBalancingComponent implements OnChanges {
  @Input() session!: PlanningSessionV2;
  @Input() isFacilitator = false;
  @Input() advancing = false;

  @Output() advance = new EventEmitter<void>();
  @Output() back = new EventEmitter<void>();

  private planningService = inject(PlanningService);

  readonly lanes = signal<PersonLane[]>([]);
  readonly totalCommittedSP = signal(0);
  readonly totalIssues = signal(0);
  readonly savingCapacity = signal(false);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['session'] && this.session) {
      this.rebuildLanes();
    }
  }

  private rebuildLanes(): void {
    const reviews = this.session.issueReviews ?? [];
    const entries = computeCapacity(
      reviews,
      this.session.participantIds,
      this.session.participantNames,
    );
    const max = maxPlannedSP(entries);

    const lanes: PersonLane[] = entries.map((e) => ({
      ...e,
      issues: this.getCommittedIssuesFor(e.name, e.uid, reviews),
      barPct: max === 0 ? 0 : Math.round((e.plannedSP / max) * 100),
    }));

    this.lanes.set(lanes);

    const committedReviews = reviews.filter(
      (r) => r.outcome === 'confirmed' || r.outcome === 'risky-accepted',
    );
    this.totalCommittedSP.set(
      committedReviews.reduce((s, r) => s + (r.storyPoints ?? 0), 0),
    );
    this.totalIssues.set(committedReviews.length);
  }

  private getCommittedIssuesFor(
    name: string,
    uid: string,
    reviews: IssueReview[],
  ): LaneIssue[] {
    return reviews
      .filter(
        (r) =>
          (r.outcome === 'confirmed' || r.outcome === 'risky-accepted') &&
          (r.assignee === name || r.assignee === uid || (!r.assignee && uid === '')),
      )
      .map((r) => ({
        issueId: r.issueId,
        issueKey: r.issueKey,
        title: r.title,
        storyPoints: r.storyPoints,
        outcome: r.outcome,
        type: r.type,
      }));
  }

  async saveAndAdvance(): Promise<void> {
    const s = this.session;
    if (!s?.id || !this.isFacilitator) return;

    const entries: CapacityEntry[] = this.lanes().map((l) => ({
      uid: l.uid,
      name: l.name,
      plannedSP: l.plannedSP,
      availableSP: l.availableSP,
      isOverloaded: l.isOverloaded,
    }));
    const summary = computeSessionSummary(s.issueReviews);

    this.savingCapacity.set(true);
    try {
      await this.planningService.updateCapacityAndSummary(s.id, entries, summary);
      this.advance.emit();
    } finally {
      this.savingCapacity.set(false);
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
