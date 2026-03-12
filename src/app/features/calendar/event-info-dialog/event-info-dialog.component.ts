import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  MatDialogRef,
  MAT_DIALOG_DATA,
  MatDialogModule,
} from '@angular/material/dialog';
import { format, parseISO } from 'date-fns';
import { CalendarService } from '../../../core/services/calendar.service';
import { CalendarEvent } from '../../../core/models/event.model';
import { AppUser } from '../../../core/models/user.model';

export interface EventInfoDialogData {
  eventTitle: string;
  eventType: string;
  badge: string;
  date: string; // YYYY-MM-DD
  timeDisplay: string;
  user: AppUser;
  sprintNumber: number;
  sprintIsDone: boolean;
  event: CalendarEvent | null; // null = computed sprint ceremony (not removable)
  teamId: string;
}

@Component({
  selector: 'app-event-info-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatDialogModule,
  ],
  templateUrl: './event-info-dialog.component.html',
  styleUrls: ['./event-info-dialog.component.scss'],
})
export class EventInfoDialogComponent {
  private dialogRef = inject(MatDialogRef<EventInfoDialogComponent>);
  data: EventInfoDialogData = inject(MAT_DIALOG_DATA);
  private calendarService = inject(CalendarService);

  removing = signal(false);

  get dateLabel(): string {
    try {
      return format(parseISO(this.data.date), 'EEE, MMMM d, yyyy');
    } catch {
      return this.data.date;
    }
  }

  get vacationRangeLabel(): string | null {
    const evt = this.data.event;
    if (this.data.eventType !== 'vacation' || !evt) return null;
    const start = format(parseISO(evt.date), 'MMM d, yyyy');
    if (!evt.endDate || evt.endDate === evt.date) return start;
    const end = format(parseISO(evt.endDate), 'MMM d, yyyy');
    return `${start} – ${end}`;
  }

  private readonly avatarPalette = [
    ['#6366f1', '#8b5cf6'],
    ['#0ea5e9', '#6366f1'],
    ['#14b8a6', '#0ea5e9'],
    ['#f43f5e', '#ec4899'],
    ['#22c55e', '#16a34a'],
    ['#f97316', '#ef4444'],
  ];

  getAvatarGradient(uid: string): string {
    const hash = uid.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const [c1, c2] = this.avatarPalette[hash % this.avatarPalette.length];
    return `linear-gradient(135deg, ${c1}, ${c2})`;
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

  async remove(): Promise<void> {
    const evt = this.data.event;
    if (!evt || this.removing()) return;
    this.removing.set(true);
    try {
      await this.calendarService.removeEvent(evt.userId, evt.date);
      this.dialogRef.close(true);
    } catch (e) {
      console.error('[EventInfoDialog] remove failed', e);
      this.removing.set(false);
    }
  }

  close(): void {
    this.dialogRef.close(false);
  }
}
