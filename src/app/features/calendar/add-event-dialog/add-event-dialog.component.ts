import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
  MatDialogRef,
  MAT_DIALOG_DATA,
  MatDialogModule,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatRippleModule } from '@angular/material/core';
import { format, parseISO, eachDayOfInterval, isWeekend } from 'date-fns';
import { CalendarService } from '../../../core/services/calendar.service';
import { AuthService } from '../../../core/services/auth.service';
import { EventType } from '../../../core/models/event.model';
import { AppUser } from '../../../core/models/user.model';

export interface AddEventDialogData {
  members: AppUser[];
  teamId: string;
  defaultDate?: string;
}

interface EventTypeOption {
  type: EventType;
  label: string;
  shortLabel: string;
  color: string;
  bg: string;
}

@Component({
  selector: 'app-add-event-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatIconModule,
    MatRippleModule,
  ],
  templateUrl: './add-event-dialog.component.html',
  styleUrls: ['./add-event-dialog.component.scss'],
})
export class AddEventDialogComponent implements OnInit {
  private dialogRef = inject(MatDialogRef<AddEventDialogComponent>);
  private data: AddEventDialogData = inject(MAT_DIALOG_DATA);
  private calendarService = inject(CalendarService);
  private authService = inject(AuthService);

  members = this.data.members;
  teamId = this.data.teamId;

  selectedType = signal<EventType>('refinement');
  selectedMemberUids = signal<Set<string>>(new Set());
  startDate = signal(this.data.defaultDate ?? format(new Date(), 'yyyy-MM-dd'));
  endDate = signal(this.data.defaultDate ?? format(new Date(), 'yyyy-MM-dd'));
  note = signal('');
  saving = signal(false);

  readonly eventTypes: EventTypeOption[] = [
    {
      type: 'refinement',
      label: 'Refinement',
      shortLabel: 'Rfmt',
      color: '#fcd34d',
      bg: 'rgba(245,158,11,0.18)',
    },
    {
      type: 'planning',
      label: 'Planning',
      shortLabel: 'Plan',
      color: '#6ee7b7',
      bg: 'rgba(16,185,129,0.18)',
    },
    {
      type: 'sprint-review',
      label: 'Sprint Review',
      shortLabel: 'SR',
      color: '#fdba74',
      bg: 'rgba(249,115,22,0.18)',
    },
    {
      type: 'vacation',
      label: 'Vacation',
      shortLabel: 'Vac',
      color: '#c4b5fd',
      bg: 'rgba(139,92,246,0.18)',
    },
  ];

  get selectedTypeOption(): EventTypeOption {
    return this.eventTypes.find((e) => e.type === this.selectedType())!;
  }

  get dateRangeValid(): boolean {
    return this.startDate() <= this.endDate();
  }

  get totalDays(): number {
    if (!this.dateRangeValid) return 0;
    try {
      const days = eachDayOfInterval({
        start: parseISO(this.startDate()),
        end: parseISO(this.endDate()),
      }).filter((d) => !isWeekend(d));
      return days.length;
    } catch {
      return 0;
    }
  }

  ngOnInit(): void {
    // Pre-select all members
    this.selectedMemberUids.set(new Set(this.members.map((m) => m.uid)));
  }

  toggleMember(uid: string): void {
    const s = new Set(this.selectedMemberUids());
    if (s.has(uid)) {
      s.delete(uid);
    } else {
      s.add(uid);
    }
    this.selectedMemberUids.set(s);
  }

  isMemberSelected(uid: string): boolean {
    return this.selectedMemberUids().has(uid);
  }

  selectAllMembers(): void {
    this.selectedMemberUids.set(new Set(this.members.map((m) => m.uid)));
  }

  clearMembers(): void {
    this.selectedMemberUids.set(new Set());
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

  async save(): Promise<void> {
    if (this.saving()) return;
    if (!this.dateRangeValid || this.selectedMemberUids().size === 0) return;

    this.saving.set(true);
    const currentUser = this.authService.currentUser;
    const type = this.selectedType();
    const note = this.note().trim() || undefined;

    try {
      const workDays = eachDayOfInterval({
        start: parseISO(this.startDate()),
        end: parseISO(this.endDate()),
      }).filter((d) => !isWeekend(d));

      const writes: Promise<void>[] = [];
      for (const uid of this.selectedMemberUids()) {
        for (const day of workDays) {
          const dateStr = format(day, 'yyyy-MM-dd');
          writes.push(
            this.calendarService.setEvent({
              userId: uid,
              teamId: this.teamId,
              type,
              date: dateStr,
              endDate:
                this.startDate() !== this.endDate()
                  ? this.endDate()
                  : undefined,
              status: 'approved',
              note,
              createdBy: currentUser!.uid,
              createdAt: new Date(),
            }),
          );
        }
      }
      await Promise.all(writes);
      this.dialogRef.close(true);
    } finally {
      this.saving.set(false);
    }
  }

  close(): void {
    this.dialogRef.close(false);
  }
}
