import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { format, eachDayOfInterval, isWeekend } from 'date-fns';

export interface SprintDay {
  dateStr: string;
  label: string; // 'Mon', 'Tue', …
  dayNum: string;
  isToday: boolean;
  isPast: boolean;
  isWeekend: boolean;
}

export interface SprintDaysDialogData {
  sprintNumber: number;
  remaining: number;
  elapsed: number;
  total: number;
  percent: number;
  startDate: string; // formatted 'MMM d'
  endDate: string;
  sprintStartRaw: Date;
  sprintEndRaw: Date;
  asOf: Date;
}

@Component({
  selector: 'app-sprint-days-dialog',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './sprint-days-dialog.component.html',
  styleUrls: ['./sprint-days-dialog.component.scss'],
})
export class SprintDaysDialogComponent {
  private dialogRef = inject(MatDialogRef<SprintDaysDialogComponent>);
  readonly data: SprintDaysDialogData = inject(MAT_DIALOG_DATA);

  get asOfFormatted(): string {
    return format(this.data.asOf, 'MMM d, h:mm aa');
  }

  get statusLabel(): string {
    if (this.data.remaining === 0) return 'Sprint Complete';
    if (this.data.elapsed === 0) return 'Sprint Not Started';
    return 'In Progress';
  }

  get urgencyClass(): string {
    const pct = this.data.percent;
    if (pct >= 80) return 'urgent';
    if (pct >= 50) return 'mid';
    return 'early';
  }

  get ringDash(): string {
    // circumference of r=44 circle ≈ 276.46
    const circ = 2 * Math.PI * 44;
    const filled = circ * (this.data.percent / 100);
    return `${filled} ${circ}`;
  }

  get ringColor(): string {
    const pct = this.data.percent;
    if (pct >= 80) return '#f87171';
    if (pct >= 50) return '#f59e0b';
    return '#6366f1';
  }

  get days(): SprintDay[] {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    return eachDayOfInterval({
      start: this.data.sprintStartRaw,
      end: this.data.sprintEndRaw,
    }).map((d) => {
      const dateStr = format(d, 'yyyy-MM-dd');
      return {
        dateStr,
        label: format(d, 'EEE'),
        dayNum: format(d, 'd'),
        isToday: dateStr === todayStr,
        isPast: dateStr < todayStr,
        isWeekend: isWeekend(d),
      };
    });
  }

  workDays(): SprintDay[] {
    return this.days.filter((d) => !d.isWeekend);
  }

  close(): void {
    this.dialogRef.close();
  }
}
