import { Component, computed, inject, signal } from '@angular/core';
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
}

const FILTER_TYPES: Record<string, string[]> = {
  sprint: ['refinement', 'planning', 'sprint-review'],
  activity: ['activity'],
  vacation: ['vacation'],
};

interface FilterChip {
  label: string;
  value: string;
  icon: string | null;
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

  readonly filterChips: FilterChip[] = [
    { label: 'All types', value: 'all', icon: 'filter_list' },
    { label: 'Sprint', value: 'sprint', icon: null },
    { label: 'Activity', value: 'activity', icon: null },
    { label: 'Vacation', value: 'vacation', icon: null },
  ];

  activeFilter = signal('all');

  filteredRows = computed(() => {
    const f = this.activeFilter();
    if (f === 'all') return this.data.rows;
    const types = FILTER_TYPES[f] ?? [];
    return this.data.rows.filter((r) => types.includes(r.type));
  });

  badgeClass(row: UpcomingEventRow): string {
    if (row.isToday) return 'today';
    if (row.daysAway === 1) return 'tomorrow';
    return 'future';
  }

  close(): void {
    this.dialogRef.close();
  }
}
