import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { PlanningSessionV2 } from '../../../../../core/models/planning-session.model';

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
      .reduce((s, r) => s + (r.storyPoints ?? 0), 0);
  }

  get participantCount(): number {
    return this.session.participantIds?.length ?? 0;
  }
}
