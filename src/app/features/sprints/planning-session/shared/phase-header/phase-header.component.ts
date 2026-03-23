import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { PlanningPhase } from '../../../../../core/models/planning-session.model';

interface PhaseConfig {
  phase: PlanningPhase;
  label: string;
  icon: string;
}

export const PHASE_CONFIGS: PhaseConfig[] = [
  { phase: 'setup', label: 'Setup', icon: 'tune' },
  { phase: 'readiness', label: 'Readiness', icon: 'health_and_safety' },
  { phase: 'context', label: 'Context', icon: 'info' },
  { phase: 'review', label: 'Review', icon: 'rate_review' },
  { phase: 'balancing', label: 'Balance', icon: 'balance' },
  { phase: 'final-review', label: 'Final Review', icon: 'fact_check' },
  { phase: 'finalized', label: 'Committed', icon: 'task_alt' },
];

@Component({
  selector: 'app-phase-header',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './phase-header.component.html',
  styleUrls: ['./phase-header.component.scss'],
})
export class PhaseHeaderComponent {
  @Input() currentPhase: PlanningPhase = 'setup';

  readonly phases = PHASE_CONFIGS;

  getState(phase: PhaseConfig): 'done' | 'active' | 'upcoming' {
    const currentIdx = this.phases.findIndex(
      (p) => p.phase === this.currentPhase,
    );
    const phaseIdx = this.phases.indexOf(phase);
    if (phaseIdx < currentIdx) return 'done';
    if (phaseIdx === currentIdx) return 'active';
    return 'upcoming';
  }

  get currentIndex(): number {
    return this.phases.findIndex((p) => p.phase === this.currentPhase);
  }

  get currentConfig(): PhaseConfig {
    return this.phases[this.currentIndex] ?? this.phases[0];
  }
}
