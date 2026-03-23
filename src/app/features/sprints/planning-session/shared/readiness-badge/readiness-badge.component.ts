import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

export type ReadinessSeverity = 'critical' | 'warning' | 'info';

@Component({
  selector: 'app-readiness-badge',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatTooltipModule],
  template: `
    <span
      class="rb"
      [class.rb--critical]="severity === 'critical'"
      [class.rb--warning]="severity === 'warning'"
      [class.rb--info]="severity === 'info'"
      [matTooltip]="tooltip || ''"
    >
      <mat-icon class="rb__icon">{{ icon }}</mat-icon>
      <span class="rb__label">{{ label }}</span>
    </span>
  `,
  styles: [`
    :host { display: inline-flex; }

    .rb {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 3px 10px 3px 6px;
      border-radius: 100px;
      font: 500 0.75rem/1 'Inter', sans-serif;
      white-space: nowrap;

      .rb__icon {
        font-size: 14px;
        width: 14px;
        height: 14px;
        flex-shrink: 0;
      }
    }

    .rb--critical {
      background: rgba(239, 68, 68, 0.12);
      border: 1px solid rgba(239, 68, 68, 0.25);
      color: #dc2626;
      .rb__icon { color: #ef4444; }
      [data-theme='dark'] & { color: #fca5a5; .rb__icon { color: #f87171; } }
    }

    .rb--warning {
      background: rgba(245, 158, 11, 0.12);
      border: 1px solid rgba(245, 158, 11, 0.25);
      color: #d97706;
      .rb__icon { color: #f59e0b; }
      [data-theme='dark'] & { color: #fcd34d; .rb__icon { color: #fbbf24; } }
    }

    .rb--info {
      background: color-mix(in srgb, var(--c-accent) 10%, transparent);
      border: 1px solid color-mix(in srgb, var(--c-accent) 25%, transparent);
      color: var(--c-accent);
      .rb__icon { color: var(--c-accent); }
    }
  `],
})
export class ReadinessBadgeComponent {
  @Input() severity: ReadinessSeverity = 'info';
  @Input() label = '';
  @Input() icon = 'info';
  @Input() tooltip = '';
}
