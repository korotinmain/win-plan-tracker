import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  computed,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { PlanningSessionV2 } from '../../../../../core/models/planning-session.model';
import { ReadinessBadgeComponent } from '../../shared/readiness-badge/readiness-badge.component';
import {
  ReadinessWarning,
  computeReadinessWarnings,
  isReadinessClean,
} from './readiness.util';

@Component({
  selector: 'app-phase-readiness',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, ReadinessBadgeComponent],
  templateUrl: './phase-readiness.component.html',
  styleUrls: ['./phase-readiness.component.scss'],
})
export class PhaseReadinessComponent implements OnChanges {
  @Input() session!: PlanningSessionV2;
  @Input() isFacilitator = false;
  @Input() advancing = false;

  @Output() advance = new EventEmitter<void>();
  @Output() back = new EventEmitter<void>();

  readonly warnings = signal<ReadinessWarning[]>([]);
  readonly expandedId = signal<string | null>(null);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['session'] && this.session) {
      this.warnings.set(computeReadinessWarnings(this.session.issueReviews));
    }
  }

  get isClean(): boolean {
    return isReadinessClean(this.warnings());
  }

  get criticalCount(): number {
    return this.warnings().filter((w) => w.severity === 'critical').length;
  }

  get warningCount(): number {
    return this.warnings().filter((w) => w.severity === 'warning').length;
  }

  get infoCount(): number {
    return this.warnings().filter((w) => w.severity === 'info').length;
  }

  toggle(id: string): void {
    this.expandedId.set(this.expandedId() === id ? null : id);
  }

  isExpanded(id: string): boolean {
    return this.expandedId() === id;
  }
}
