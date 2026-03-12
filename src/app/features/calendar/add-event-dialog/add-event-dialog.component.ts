import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  MatDialogRef,
  MAT_DIALOG_DATA,
  MatDialogModule,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import {
  MatDatepickerModule,
  DateRange,
  DefaultMatCalendarRangeStrategy,
  MAT_DATE_RANGE_SELECTION_STRATEGY,
  MatCalendarCellClassFunction,
} from '@angular/material/datepicker';
import {
  NativeDateAdapter,
  DateAdapter,
  MAT_DATE_FORMATS,
  MAT_NATIVE_DATE_FORMATS,
} from '@angular/material/core';
import { format, parseISO, eachDayOfInterval, isWeekend } from 'date-fns';
import { CalendarService } from '../../../core/services/calendar.service';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AppUser } from '../../../core/models/user.model';

class MondayFirstDateAdapter extends NativeDateAdapter {
  override getFirstDayOfWeek(): number {
    return 1;
  }
}

export interface AddEventDialogData {
  members: AppUser[];
  teamId: string;
  defaultDate?: string;
}

@Component({
  selector: 'app-add-event-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatIconModule,
    MatDatepickerModule,
  ],
  providers: [
    { provide: DateAdapter, useClass: MondayFirstDateAdapter },
    { provide: MAT_DATE_FORMATS, useValue: MAT_NATIVE_DATE_FORMATS },
    DefaultMatCalendarRangeStrategy,
    {
      provide: MAT_DATE_RANGE_SELECTION_STRATEGY,
      useExisting: DefaultMatCalendarRangeStrategy,
    },
  ],
  templateUrl: './add-event-dialog.component.html',
  styleUrls: ['./add-event-dialog.component.scss'],
})
export class AddEventDialogComponent {
  private dialogRef = inject(MatDialogRef<AddEventDialogComponent>);
  private data: AddEventDialogData = inject(MAT_DIALOG_DATA);
  private calendarService = inject(CalendarService);
  private authService = inject(AuthService);
  private notifService = inject(NotificationService);
  private rangeStrategy = inject<DefaultMatCalendarRangeStrategy<Date>>(
    DefaultMatCalendarRangeStrategy,
  );

  members = this.data.members;
  teamId = this.data.teamId;

  private readonly _defaultDate = this.data.defaultDate
    ? parseISO(this.data.defaultDate)
    : new Date();

  selectedRange: DateRange<Date> = new DateRange<Date>(
    this._defaultDate,
    this._defaultDate,
  );

  note = signal('');
  saving = signal(false);

  get isSelectingEnd(): boolean {
    return !!this.selectedRange.start && !this.selectedRange.end;
  }

  get dateRangeValid(): boolean {
    return !!(this.selectedRange.start && this.selectedRange.end);
  }

  get totalDays(): number {
    const { start, end } = this.selectedRange;
    if (!start || !end) return 0;
    try {
      return eachDayOfInterval({ start, end }).filter((d) => !isWeekend(d))
        .length;
    } catch {
      return 0;
    }
  }

  get hasNoWorkdays(): boolean {
    return this.dateRangeValid && this.totalDays === 0;
  }

  get startDateStr(): string | null {
    return this.selectedRange.start
      ? format(this.selectedRange.start, 'yyyy-MM-dd')
      : null;
  }

  get endDateStr(): string | null {
    return this.selectedRange.end
      ? format(this.selectedRange.end, 'yyyy-MM-dd')
      : null;
  }

  readonly dateClass: MatCalendarCellClassFunction<Date> = (
    date: Date,
    view: 'month' | 'year' | 'multi-year',
  ) => {
    if (view !== 'month') return '';
    const day = date.getDay();
    return day === 0 || day === 6 ? 'cal-weekend' : '';
  };

  onDateSelected(date: Date | null): void {
    if (!date) return;
    this.selectedRange = this.rangeStrategy.selectionFinished(
      date,
      this.selectedRange,
    );
  }

  async save(): Promise<void> {
    if (this.saving() || !this.dateRangeValid || this.totalDays === 0) return;
    const currentUser = this.authService.currentUser;
    if (!currentUser) return;

    this.saving.set(true);
    const note = this.note().trim() || undefined;
    const startStr = this.startDateStr!;
    const endStr = this.endDateStr!;

    try {
      const workDays = eachDayOfInterval({
        start: this.selectedRange.start!,
        end: this.selectedRange.end!,
      }).filter((d) => !isWeekend(d));

      await Promise.all(
        workDays.map((day) =>
          this.calendarService.setEvent({
            userId: currentUser.uid,
            teamId: this.teamId,
            type: 'vacation',
            date: format(day, 'yyyy-MM-dd'),
            endDate: startStr !== endStr ? endStr : undefined,
            status: 'approved',
            note,
            createdBy: currentUser.uid,
            createdAt: new Date(),
          }),
        ),
      );

      if (this.members.length > 1) {
        await this.notifService.createForTeam(
          currentUser,
          this.teamId,
          'vacation',
          startStr,
          startStr !== endStr ? endStr : undefined,
          note,
          this.members,
        );
      }

      this.dialogRef.close(true);
    } finally {
      this.saving.set(false);
    }
  }

  close(): void {
    this.dialogRef.close(false);
  }
}
