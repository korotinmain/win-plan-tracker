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
import { differenceInBusinessDays, parseISO } from 'date-fns';
import { PlanningSessionV2 } from '../../../../../core/models/planning-session.model';

interface IssueTypeStat {
  type: string;
  count: number;
  sp: number;
}

@Component({
  selector: 'app-phase-context',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './phase-context.component.html',
  styleUrls: ['./phase-context.component.scss'],
})
export class PhaseContextComponent implements OnChanges {
  @Input() session!: PlanningSessionV2;
  @Input() isFacilitator = false;
  @Input() advancing = false;

  @Output() advance = new EventEmitter<void>();
  @Output() back = new EventEmitter<void>();

  readonly typeStats = signal<IssueTypeStat[]>([]);
  readonly totalSP = signal(0);
  readonly totalIssues = signal(0);
  readonly workingDays = signal<number | null>(null);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['session'] && this.session) {
      this.computeStats();
    }
  }

  private computeStats(): void {
    const reviews = this.session.issueReviews ?? [];

    // Issue type breakdown
    const typeMap = new Map<string, { count: number; sp: number }>();
    let total = 0;
    for (const r of reviews) {
      const key = r.type || 'Unknown';
      const existing = typeMap.get(key) ?? { count: 0, sp: 0 };
      typeMap.set(key, {
        count: existing.count + 1,
        sp: existing.sp + (r.storyPoints ?? 0),
      });
      total += r.storyPoints ?? 0;
    }
    const stats: IssueTypeStat[] = Array.from(typeMap.entries())
      .map(([type, { count, sp }]) => ({ type, count, sp }))
      .sort((a, b) => b.count - a.count);

    this.typeStats.set(stats);
    this.totalSP.set(total);
    this.totalIssues.set(reviews.length);

    // Working days
    if (this.session.sprintStartDate && this.session.sprintEndDate) {
      try {
        const days = differenceInBusinessDays(
          parseISO(this.session.sprintEndDate),
          parseISO(this.session.sprintStartDate),
        );
        this.workingDays.set(Math.max(0, days));
      } catch {
        this.workingDays.set(null);
      }
    } else {
      this.workingDays.set(null);
    }
  }

  get sprintDateRange(): string {
    const { sprintStartDate, sprintEndDate } = this.session;
    if (!sprintStartDate && !sprintEndDate) return 'Dates not set';
    const fmt = (d: string) =>
      new Date(d).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    if (sprintStartDate && sprintEndDate)
      return `${fmt(sprintStartDate)} – ${fmt(sprintEndDate)}`;
    if (sprintStartDate) return `From ${fmt(sprintStartDate)}`;
    return `Until ${fmt(sprintEndDate!)}`;
  }

  getTypeIcon(type: string): string {
    const t = type.toLowerCase();
    if (t.includes('story')) return 'bookmark';
    if (t.includes('bug')) return 'bug_report';
    if (t.includes('task')) return 'task_alt';
    if (t.includes('epic')) return 'auto_awesome';
    if (t.includes('sub')) return 'subdirectory_arrow_right';
    return 'circle';
  }
}
