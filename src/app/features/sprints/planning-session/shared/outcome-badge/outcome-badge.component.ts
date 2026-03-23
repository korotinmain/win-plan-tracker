import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { IssueOutcome } from '../../../../../core/models/planning-session.model';

export interface OutcomeConfig {
  label: string;
  icon: string;
  cssClass: string;
}

export const OUTCOME_CONFIGS: Record<IssueOutcome, OutcomeConfig> = {
  confirmed: { label: 'Confirmed', icon: 'check_circle', cssClass: 'ob--confirmed' },
  reassigned: { label: 'Reassigned', icon: 'swap_horiz', cssClass: 'ob--reassigned' },
  'risky-accepted': { label: 'Risky – Accepted', icon: 'warning', cssClass: 'ob--risky' },
  'needs-clarification': { label: 'Needs Clarification', icon: 'help', cssClass: 'ob--unclear' },
  deferred: { label: 'Deferred', icon: 'cancel', cssClass: 'ob--deferred' },
  'split-candidate': { label: 'Split Candidate', icon: 'call_split', cssClass: 'ob--split' },
};

@Component({
  selector: 'app-outcome-badge',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    @if (outcome) {
      <span
        class="ob"
        [class.ob--confirmed]="outcome === 'confirmed'"
        [class.ob--reassigned]="outcome === 'reassigned'"
        [class.ob--risky]="outcome === 'risky-accepted'"
        [class.ob--unclear]="outcome === 'needs-clarification'"
        [class.ob--deferred]="outcome === 'deferred'"
        [class.ob--split]="outcome === 'split-candidate'"
      >
        <mat-icon class="ob__icon">{{ config.icon }}</mat-icon>
        <span class="ob__label">{{ config.label }}</span>
      </span>
    }
  `,
  styles: [`
    :host { display: inline-flex; }

    .ob {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 3px 10px 3px 6px;
      border-radius: 100px;
      font: 600 0.72rem/1 'Inter', sans-serif;
      white-space: nowrap;
      border: 1px solid transparent;

      .ob__icon {
        font-size: 14px; width: 14px; height: 14px; flex-shrink: 0;
      }
    }

    .ob--confirmed {
      background: rgba(34, 197, 94, 0.14);
      border-color: rgba(34, 197, 94, 0.30);
      color: #16a34a;
      .ob__icon { color: #22c55e; }
    }
    .ob--reassigned {
      background: rgba(59, 130, 246, 0.13);
      border-color: rgba(59, 130, 246, 0.28);
      color: #2563eb;
      .ob__icon { color: #3b82f6; }
    }
    .ob--risky {
      background: rgba(249, 115, 22, 0.13);
      border-color: rgba(249, 115, 22, 0.28);
      color: #ea580c;
      .ob__icon { color: #f97316; }
    }
    .ob--unclear {
      background: rgba(168, 85, 247, 0.13);
      border-color: rgba(168, 85, 247, 0.28);
      color: #9333ea;
      .ob__icon { color: #a855f7; }
    }
    .ob--deferred {
      background: rgba(239, 68, 68, 0.12);
      border-color: rgba(239, 68, 68, 0.28);
      color: #dc2626;
      .ob__icon { color: #ef4444; }
    }
    .ob--split {
      background: rgba(20, 184, 166, 0.13);
      border-color: rgba(20, 184, 166, 0.28);
      color: #0d9488;
      .ob__icon { color: #14b8a6; }
    }
  `],
})
export class OutcomeBadgeComponent {
  @Input() outcome: IssueOutcome | null = null;

  get config(): OutcomeConfig {
    return this.outcome ? OUTCOME_CONFIGS[this.outcome] : OUTCOME_CONFIGS['confirmed'];
  }
}
