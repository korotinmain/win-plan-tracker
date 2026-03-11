import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  MatDialogRef,
  MAT_DIALOG_DATA,
  MatDialogModule,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { format } from 'date-fns';
import { CalendarEvent } from '../../../core/models/event.model';
import { AppUser } from '../../../core/models/user.model';

export type KpiType =
  | 'working'
  | 'vacation'
  | 'refinement'
  | 'planning'
  | 'sprint-review';

export interface KpiDetailDialogData {
  type: KpiType;
  activeMembers: { user: AppUser; event: CalendarEvent | null }[];
  summary: {
    working: number;
    onVacation: number;
    onRefinement: number;
    onPlanning: number;
    onSprintReview: number;
    total: number;
  };
  asOf: Date;
}

interface KpiConfig {
  title: string;
  subtitle: string;
  icon: string;
  accentColor: string;
  accentBg: string;
  gradient: string;
  defaultNote: string;
}

@Component({
  selector: 'app-kpi-detail-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatIconModule],
  templateUrl: './kpi-detail-dialog.component.html',
  styleUrls: ['./kpi-detail-dialog.component.scss'],
})
export class KpiDetailDialogComponent {
  private dialogRef = inject(MatDialogRef<KpiDetailDialogComponent>);
  readonly data: KpiDetailDialogData = inject(MAT_DIALOG_DATA);

  readonly configs: Record<KpiType, KpiConfig> = {
    working: {
      title: 'Working',
      subtitle: 'Team members currently working',
      icon: 'laptop_mac',
      accentColor: '#10b981',
      accentBg: 'rgba(16,185,129,0.18)',
      gradient: 'linear-gradient(90deg, #059669, #34d399)',
      defaultNote: 'Working today',
    },
    vacation: {
      title: 'On Vacation',
      subtitle: 'Team members on vacation',
      icon: 'beach_access',
      accentColor: '#8b5cf6',
      accentBg: 'rgba(139,92,246,0.18)',
      gradient: 'linear-gradient(90deg, #7c3aed, #a78bfa)',
      defaultNote: 'On vacation',
    },
    refinement: {
      title: 'Refinement',
      subtitle: 'Team members in refinement sessions',
      icon: 'assignment_turned_in',
      accentColor: '#f59e0b',
      accentBg: 'rgba(245,158,11,0.18)',
      gradient: 'linear-gradient(90deg, #d97706, #fcd34d)',
      defaultNote: 'Refining Sprint backlog items',
    },
    planning: {
      title: 'Planning',
      subtitle: 'Team members in planning sessions',
      icon: 'event_note',
      accentColor: '#06b6d4',
      accentBg: 'rgba(6,182,212,0.18)',
      gradient: 'linear-gradient(90deg, #0891b2, #67e8f9)',
      defaultNote: 'Planning sprint tasks',
    },
    'sprint-review': {
      title: 'Sprint Review',
      subtitle: 'Team members in sprint review',
      icon: 'rate_review',
      accentColor: '#f97316',
      accentBg: 'rgba(249,115,22,0.18)',
      gradient: 'linear-gradient(90deg, #ea580c, #fdba74)',
      defaultNote: 'Reviewing sprint deliverables',
    },
  };

  get config(): KpiConfig {
    return this.configs[this.data.type];
  }

  get cssVars(): Record<string, string> {
    const c = this.config;
    return {
      '--kd-gradient': c.gradient,
      '--kd-accent-20': c.accentColor + '33',
      '--kd-accent-10': c.accentColor + '1a',
    };
  }

  get activeCount(): number {
    return this.data.activeMembers.length;
  }

  get asOfFormatted(): string {
    return format(this.data.asOf, 'MMM d, h:mm aa');
  }

  get typeLabel(): string {
    const labels: Record<KpiType, string> = {
      working: 'Working',
      vacation: 'On Vacation',
      refinement: 'Refinement',
      planning: 'Planning',
      'sprint-review': 'Sprint Review',
    };
    return labels[this.data.type];
  }

  get total(): number {
    return this.data.summary.total || 1;
  }

  overviewRows = computed(() => {
    const s = this.data.summary;
    const t = s.total || 1;
    return [
      {
        label: 'Working',
        value: s.working,
        pct: (s.working / t) * 100,
        color: '#10b981',
      },
      {
        label: 'On Vacation',
        value: s.onVacation,
        pct: (s.onVacation / t) * 100,
        color: '#a78bfa',
      },
      {
        label: 'Refinement',
        value: s.onRefinement,
        pct: (s.onRefinement / t) * 100,
        color: '#f59e0b',
      },
      {
        label: 'Planning',
        value: s.onPlanning,
        pct: (s.onPlanning / t) * 100,
        color: '#10b981',
      },
      {
        label: 'Sprint Review',
        value: s.onSprintReview,
        pct: (s.onSprintReview / t) * 100,
        color: '#fb923c',
      },
    ];
  });

  memberNote(event: CalendarEvent | null): string {
    if (event?.note) return event.note;
    return this.config.defaultNote;
  }

  memberTime(event: CalendarEvent | null): string {
    if (event?.createdAt) {
      return format(new Date(event.createdAt), 'h:mm aa');
    }
    return format(this.data.asOf, 'h:mm aa');
  }

  getInitials(name: string): string {
    return (
      (name ?? '')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((n) => n[0])
        .join('')
        .toUpperCase() || '?'
    );
  }

  close(): void {
    this.dialogRef.close();
  }
}
