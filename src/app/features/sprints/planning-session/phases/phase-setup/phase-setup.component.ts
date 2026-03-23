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
import { MatTooltipModule } from '@angular/material/tooltip';
import { PlanningSessionV2 } from '../../../../../core/models/planning-session.model';

const AVATAR_COLORS: { bg: string; text: string }[] = [
  { bg: '#eef2ff', text: '#4f46e5' },
  { bg: '#f0fdf4', text: '#16a34a' },
  { bg: '#fefce8', text: '#ca8a04' },
  { bg: '#fdf2f8', text: '#be185d' },
  { bg: '#f5f3ff', text: '#7c3aed' },
  { bg: '#fff7ed', text: '#c2410c' },
  { bg: '#ecfeff', text: '#0e7490' },
  { bg: '#fef9c3', text: '#854d0e' },
];

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? '')
    .join('');
}

@Component({
  selector: 'app-phase-setup',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './phase-setup.component.html',
  styleUrls: ['./phase-setup.component.scss'],
})
export class PhaseSetupComponent implements OnChanges {
  @Input() session!: PlanningSessionV2;
  @Input() isFacilitator = false;
  @Input() advancing = false;

  @Output() advance = new EventEmitter<void>();
  @Output() exit = new EventEmitter<void>();

  readonly issueCountBySeverity = signal<{ missing: number; large: number; noOwner: number }>({
    missing: 0,
    large: 0,
    noOwner: 0,
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['session'] && this.session) {
      const reviews = this.session.issueReviews;
      this.issueCountBySeverity.set({
        missing: reviews.filter((r) => r.hasNoEstimate).length,
        large: reviews.filter((r) => r.isSuspiciouslyLarge).length,
        noOwner: reviews.filter((r) => r.hasNoAssignee).length,
      });
    }
  }

  get formattedDateRange(): string {
    const start = this.session.sprintStartDate;
    const end = this.session.sprintEndDate;
    if (!start && !end) return 'Dates not set';
    const fmt = (d: string) =>
      new Date(d).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    if (start && end) return `${fmt(start)} – ${fmt(end)}`;
    if (start) return `Starts ${fmt(start)}`;
    return `Ends ${fmt(end!)}`;
  }

  get sprintDurationDays(): number {
    if (!this.session.sprintStartDate || !this.session.sprintEndDate) return 0;
    const start = new Date(this.session.sprintStartDate);
    const end = new Date(this.session.sprintEndDate);
    return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  }

  colorFor(index: number): { bg: string; text: string } {
    return AVATAR_COLORS[index % AVATAR_COLORS.length];
  }

  initialsFor(name: string): string {
    return getInitials(name);
  }
}
