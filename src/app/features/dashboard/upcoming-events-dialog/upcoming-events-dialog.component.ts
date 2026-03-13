import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

export interface MemberAvatar {
  initials: string;
  color: string;
  name: string;
}

export interface UpcomingEventRow {
  key: string;
  date: string;
  type: string;
  typeLabel: string;
  category: string;
  accentColor: string;
  displayDate: string;
  isToday: boolean;
  daysAway: number;
  daysLabel: string;
  memberAvatars: MemberAvatar[];
}

export interface UpcomingEventsDialogData {
  rows: UpcomingEventRow[];
  sprintNumber: number;
  currentMonth: string;
  sprintVacationCount: number;
}

@Component({
  selector: 'app-upcoming-events-dialog',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  templateUrl: './upcoming-events-dialog.component.html',
  styleUrls: ['./upcoming-events-dialog.component.scss'],
})
export class UpcomingEventsDialogComponent {
  private dialogRef = inject(MatDialogRef<UpcomingEventsDialogComponent>);
  readonly data: UpcomingEventsDialogData = inject(MAT_DIALOG_DATA);

  badgeClass(row: UpcomingEventRow): string {
    if (row.isToday) return 'today';
    if (row.daysAway === 1) return 'tomorrow';
    return 'future';
  }

  close(): void {
    this.dialogRef.close();
  }
}
