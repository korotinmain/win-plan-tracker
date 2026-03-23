import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import {
  IssueReview,
  PlanningSessionV2,
  effectiveSP,
} from '../../../../../core/models/planning-session.model';

@Component({
  selector: 'app-phase-finalized',
  standalone: true,
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './phase-finalized.component.html',
  styleUrls: ['./phase-finalized.component.scss'],
})
export class PhaseFinalizedComponent {
  @Input() session!: PlanningSessionV2;
  @Output() done = new EventEmitter<void>();

  get confirmedCount(): number {
    return (this.session.issueReviews ?? []).filter((r) => r.outcome === 'confirmed').length;
  }

  get deferredCount(): number {
    return (this.session.issueReviews ?? []).filter((r) => r.outcome === 'deferred').length;
  }

  get riskyCount(): number {
    return (this.session.issueReviews ?? []).filter((r) => r.outcome === 'risky-accepted').length;
  }

  get committedSP(): number {
    return (this.session.issueReviews ?? [])
      .filter((r) => r.outcome === 'confirmed' || r.outcome === 'risky-accepted')
      .reduce((s, r) => s + effectiveSP(r), 0);
  }

  get jiraUpdateRequired(): { issue: IssueReview; reason: string }[] {
    const committed = (this.session.issueReviews ?? []).filter(
      (r) => r.outcome === 'confirmed' || r.outcome === 'risky-accepted',
    );
    return committed
      .filter((r) => {
        const jira = r.storyPoints ?? 0;
        const planned = r.plannedStoryPoints;
        return jira === 0 || (planned != null && planned !== jira);
      })
      .map((r) => ({
        issue: r,
        reason: (r.storyPoints ?? 0) === 0
          ? 'No Jira estimate'
          : `Planned ${r.plannedStoryPoints} SP · Jira ${r.storyPoints} SP`,
      }));
  }

  get participantCount(): number {
    return this.session.participantIds?.length ?? 0;
  }
}
