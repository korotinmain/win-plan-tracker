import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  AddEventDialogComponent,
  AddEventDialogData,
} from '../add-event-dialog/add-event-dialog.component';
import {
  HolidayInfoDialogComponent,
  HolidayInfoDialogData,
} from '../holiday-info-dialog/holiday-info-dialog.component';
import {
  EventInfoDialogComponent,
  EventInfoDialogData,
} from '../event-info-dialog/event-info-dialog.component';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfISOWeek,
  endOfISOWeek,
  eachDayOfInterval,
  getISOWeek,
  isWeekend,
  parseISO,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
} from 'date-fns';
import { CalendarService } from '../../../core/services/calendar.service';
import { AuthService } from '../../../core/services/auth.service';
import { TeamService } from '../../../core/services/team.service';
import {
  HolidayService,
  PublicHoliday,
} from '../../../core/services/holiday.service';
import { CalendarEvent, Holiday } from '../../../core/models/event.model';
import { DEFAULT_CEREMONY_CONFIG } from '../../../core/models/team.model'; // only sprintLengthWeeks used
import { AppUser } from '../../../core/models/user.model';
import { combineLatest, map } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { getInitials } from '../../../shared/utils/initials.util';
import { getAvatarGradient } from '../../../shared/utils/avatar.util';

interface CalendarDay {
  date: string; // YYYY-MM-DD
  display: string; // e.g. "Mon, Apr 20"
  weekNumber: number;
  isWeekend: boolean;
  isHoliday: boolean;
  holidayName?: string;
  isFirstOfWeek: boolean;
  weekRowspan: number; // how many days share this week number
  sprintNumber: number;
  isFirstOfSprint: boolean;
  sprintDateRange: string; // e.g. "Mar 9 – Mar 22" (only when isFirstOfSprint)
}

interface RowSegment {
  days: CalendarDay[];
  type: 'vacation' | 'weekend' | 'holiday' | 'workday';
  event?: CalendarEvent;
  colspan: number;
  isToday: boolean;
}

interface MemberRow {
  user: AppUser;
  segments: RowSegment[];
}

@Component({
  selector: 'app-calendar-grid',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatTooltipModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatDividerModule,
  ],
  templateUrl: './calendar-grid.component.html',
  styleUrls: ['./calendar-grid.component.scss'],
})
export class CalendarGridComponent implements OnInit {
  private calendarService = inject(CalendarService);
  private authService = inject(AuthService);
  private teamService = inject(TeamService);
  private holidayService = inject(HolidayService);
  private dialog = inject(MatDialog);

  @ViewChild('tableWrap', { static: false })
  tableWrapRef?: ElementRef<HTMLElement>;

  currentUser = this.authService.currentUser;
  currentDate = signal(new Date());
  days = signal<CalendarDay[]>([]);
  members = signal<AppUser[]>([]);
  memberRows = signal<MemberRow[]>([]);
  holidays = signal<Holiday[]>([]);
  holidayCountryCode = signal<string | null>(null);
  loading = signal(true);

  sprintGroups = computed(() => {
    const groups: {
      sprintNumber: number;
      range: string;
      colspan: number;
      isDone: boolean;
      lastDate: string;
    }[] = [];
    for (const day of this.days()) {
      if (day.isFirstOfSprint) {
        groups.push({
          sprintNumber: day.sprintNumber,
          range: day.sprintDateRange,
          colspan: 1,
          isDone: false,
          lastDate: day.date,
        });
      } else if (groups.length > 0) {
        groups[groups.length - 1].colspan++;
        groups[groups.length - 1].lastDate = day.date;
      }
    }
    for (const g of groups) {
      g.isDone = g.lastDate < this.todayStr;
    }
    return groups;
  });

  get monthLabel(): string {
    return format(this.currentDate(), 'MMMM yyyy');
  }

  get monthName(): string {
    return format(this.currentDate(), 'MMMM');
  }

  get yearStr(): string {
    return format(this.currentDate(), 'yyyy');
  }

  view = signal<'month' | 'week'>('month');
  memberCount = computed(() => this.members().length);

  todayStr = format(new Date(), 'yyyy-MM-dd');

  get canEdit(): boolean {
    return (
      this.currentUser?.role === 'admin' || this.currentUser?.role === 'manager'
    );
  }

  ngOnInit(): void {
    this.loadCalendar();
  }

  get weekLabel(): string {
    const d = this.currentDate();
    const start = startOfISOWeek(d);
    const end = endOfISOWeek(d);
    const weekNum = getISOWeek(d);
    if (start.getMonth() === end.getMonth()) {
      return `Week ${weekNum} · ${format(start, 'MMM d')} – ${format(end, 'd')}`;
    }
    return `Week ${weekNum} · ${format(start, 'MMM d')} – ${format(end, 'MMM d')}`;
  }

  setView(v: 'month' | 'week'): void {
    this.view.set(v);
    this.loadCalendar();
  }

  prevPeriod(): void {
    if (this.view() === 'week') {
      this.currentDate.set(subWeeks(this.currentDate(), 1));
    } else {
      this.currentDate.set(subMonths(this.currentDate(), 1));
    }
    this.loadCalendar();
  }

  nextPeriod(): void {
    if (this.view() === 'week') {
      this.currentDate.set(addWeeks(this.currentDate(), 1));
    } else {
      this.currentDate.set(addMonths(this.currentDate(), 1));
    }
    this.loadCalendar();
  }

  goToToday(): void {
    this.currentDate.set(new Date());
    this.loadCalendar();
  }

  private loadCalendar(): void {
    this.loading.set(true);
    const teamId = this.currentUser?.teamId ?? '';
    const year = this.currentDate().getFullYear();
    const month = this.currentDate().getMonth() + 1;

    combineLatest([
      this.calendarService.getTeamEvents(teamId, year, month),
      this.calendarService.getHolidays(teamId),
    ])
      .pipe(map(([events, holidays]) => ({ events, holidays })))
      .subscribe(async ({ events, holidays }) => {
        const members = await this.teamService.getTeamMembers(teamId);
        this.members.set(members);
        this.holidays.set(holidays);

        // Fetch public holidays from nager.at if team has a country configured
        let publicHolidays: PublicHoliday[] = [];
        const team = await this.teamService.getTeam(teamId);
        this.holidayCountryCode.set(team?.holidayCountryCode ?? null);
        if (team?.holidayCountryCode) {
          try {
            publicHolidays = await this.holidayService.getPublicHolidays(
              year,
              team.holidayCountryCode,
            );
            console.log(
              `[Calendar] Loaded ${publicHolidays.length} public holidays for ${team.holidayCountryCode}/${year}`,
            );
          } catch (err) {
            console.error(
              `[Calendar] Failed to load public holidays for ${team.holidayCountryCode}/${year}:`,
              err,
            );
          }
        }

        const allDays =
          this.view() === 'week'
            ? eachDayOfInterval({
                start: startOfISOWeek(this.currentDate()),
                end: endOfISOWeek(this.currentDate()),
              })
            : eachDayOfInterval({
                start: startOfMonth(this.currentDate()),
                end: endOfMonth(this.currentDate()),
              });

        const holidayDates = new Set(holidays.map((h) => h.date));
        const holidayMap = new Map(holidays.map((h) => [h.date, h.name]));

        // Merge public holidays: mark observed weekday (Mon after Sat/Sun holiday)
        for (const ph of publicHolidays) {
          holidayDates.add(ph.observed);
          if (!holidayMap.has(ph.observed)) {
            holidayMap.set(
              ph.observed,
              ph.observed !== ph.date ? `${ph.name} (observed)` : ph.name,
            );
          }
        }

        // Build week groupings for rowspan
        const weekMap = new Map<number, number>();
        allDays.forEach((d) => {
          const w = getISOWeek(d);
          weekMap.set(w, (weekMap.get(w) ?? 0) + 1);
        });

        // Build team ceremony config (from Firestore or defaults)
        const cfg = {
          ...DEFAULT_CEREMONY_CONFIG,
          ...(team?.ceremonyConfig ?? {}),
        };

        // Sprint = N ISO weeks. First pass: compute sprint date ranges.
        const sprintFirstDate = new Map<number, Date>();
        const sprintLastDate = new Map<number, Date>();
        allDays.forEach((d) => {
          const sprint = Math.ceil(getISOWeek(d) / cfg.sprintLengthWeeks);
          if (!sprintFirstDate.has(sprint)) sprintFirstDate.set(sprint, d);
          sprintLastDate.set(sprint, d);
        });

        // Second pass: build CalendarDay array with sprint info.
        const calDays: CalendarDay[] = [];
        const seenWeeks = new Set<number>();
        const seenSprints = new Set<number>();
        allDays.forEach((d) => {
          const dateStr = format(d, 'yyyy-MM-dd');
          const week = getISOWeek(d);
          const sprint = Math.ceil(week / cfg.sprintLengthWeeks);
          const isFirstW = !seenWeeks.has(week);
          const isFirstS = !seenSprints.has(sprint);
          if (isFirstW) seenWeeks.add(week);
          if (isFirstS) seenSprints.add(sprint);
          let sprintDateRange = '';
          if (isFirstS) {
            const start = sprintFirstDate.get(sprint)!;
            const end = sprintLastDate.get(sprint)!;
            sprintDateRange = `${format(start, 'MMM d')} – ${format(end, 'MMM d')}`;
          }
          calDays.push({
            date: dateStr,
            display: format(d, 'EEE, MMM d'),
            weekNumber: week,
            isWeekend: isWeekend(d),
            isHoliday: holidayDates.has(dateStr),
            holidayName: holidayMap.get(dateStr),
            isFirstOfWeek: isFirstW,
            weekRowspan: weekMap.get(week) ?? 1,
            sprintNumber: sprint,
            isFirstOfSprint: isFirstS,
            sprintDateRange,
          });
        });
        this.days.set(calDays);

        // Build member rows with spanning segments
        const rows: MemberRow[] = members.map((user) => {
          const eventMap = new Map<string, CalendarEvent | null>();
          calDays.forEach((d) => eventMap.set(d.date, null));
          events
            .filter((e) => e.userId === user.uid)
            .forEach((e) => eventMap.set(e.date, e));
          return { user, segments: this.buildSegments(calDays, eventMap) };
        });
        this.memberRows.set(rows);
        this.loading.set(false);
        setTimeout(() => this.scrollToToday(), 50);
      });
  }

  private scrollToToday(): void {
    const wrap = this.tableWrapRef?.nativeElement;
    if (!wrap) return;
    const todayTh = wrap.querySelector<HTMLElement>('.th-day.is-today');
    if (!todayTh) return;
    const wrapRect = wrap.getBoundingClientRect();
    const thRect = todayTh.getBoundingClientRect();
    // Offset from wrap's left edge to the cell's left edge
    const cellLeft = todayTh.offsetLeft;
    // Scroll so the cell is centered in the visible area (minus sticky member col width ~180px)
    const stickyWidth = 180;
    const visibleWidth = wrapRect.width - stickyWidth;
    const scrollTo =
      cellLeft - stickyWidth - visibleWidth / 2 + thRect.width / 2;
    wrap.scrollTo({ left: Math.max(0, scrollTo), behavior: 'smooth' });
  }

  private buildSegments(
    allDays: CalendarDay[],
    eventMap: Map<string, CalendarEvent | null>,
  ): RowSegment[] {
    const segments: RowSegment[] = [];
    let i = 0;
    while (i < allDays.length) {
      const day = allDays[i];
      const event = eventMap.get(day.date) ?? null;
      const eventType = event?.type as string | undefined;
      if (eventType === 'vacation' || eventType === 'day-off') {
        // Merge all directly adjacent vacation events into one bar
        let mergeEnd = event!.endDate ?? event!.date;
        let j = i;
        while (true) {
          // Advance j past the current merged end date
          while (j < allDays.length && allDays[j].date <= mergeEnd) {
            j++;
          }
          // If the very next calendar day also starts a vacation, extend
          if (j < allDays.length) {
            const nextEvent = eventMap.get(allDays[j].date);
            const nextType = nextEvent?.type as string | undefined;
            if (nextType === 'vacation' || nextType === 'day-off') {
              const nextEnd = nextEvent!.endDate ?? nextEvent!.date;
              if (nextEnd > mergeEnd) mergeEnd = nextEnd;
            } else {
              break;
            }
          } else {
            break;
          }
        }
        const spanDays = allDays.slice(i, j);
        segments.push({
          days: spanDays,
          type: 'vacation',
          event: event ?? undefined,
          colspan: spanDays.length,
          isToday: spanDays.some((d) => d.date === this.todayStr),
        });
        i = j;
      } else {
        const type: RowSegment['type'] = day.isHoliday
          ? 'holiday'
          : day.isWeekend
            ? 'weekend'
            : 'workday';
        segments.push({
          days: [day],
          type,
          event: event ?? undefined,
          colspan: 1,
          isToday: day.date === this.todayStr,
        });
        i++;
      }
    }
    return segments;
  }

  openHolidayInfo(day: CalendarDay): void {
    this.dialog.open(HolidayInfoDialogComponent, {
      data: {
        holidayName: day.holidayName ?? 'Public Holiday',
        date: day.date,
        countryCode: this.holidayCountryCode(),
        isWeekend: day.isWeekend,
      } as HolidayInfoDialogData,
      panelClass: 'holiday-info-dialog-overlay',
      width: '400px',
      maxWidth: '96vw',
    });
  }

  openAddEventDialog(defaultDate?: string): void {
    const ref = this.dialog.open(AddEventDialogComponent, {
      data: {
        members: this.members(),
        teamId: this.currentUser?.teamId ?? '',
        defaultDate,
      } as AddEventDialogData,
      panelClass: 'add-event-dialog-overlay',
      width: '580px',
      maxWidth: '96vw',
      backdropClass: 'add-event-backdrop',
    });
    ref.afterClosed().subscribe((saved) => {
      if (saved) this.loadCalendar();
    });
  }

  openSegmentEvent(seg: RowSegment, row: MemberRow): void {
    if (!seg.event) return;
    const type = 'vacation';
    const day = seg.days[0];
    const sprintGroup = this.sprintGroups().find(
      (g) => g.sprintNumber === day.sprintNumber,
    );
    const timeDisplay =
      seg.event.startTime && seg.event.endTime
        ? `${seg.event.startTime} – ${seg.event.endTime}`
        : 'All day';
    const titleMap: Record<string, string> = {
      vacation: 'Vacation',
      'day-off': 'Day Off',
    };
    const badgeMap: Record<string, string> = {
      vacation: 'VAC',
      'day-off': 'OFF',
    };
    this.dialog
      .open(EventInfoDialogComponent, {
        data: {
          eventTitle: titleMap[type] ?? type,
          eventType: type,
          badge: badgeMap[type] ?? type.toUpperCase().slice(0, 4),
          date: day.date,
          timeDisplay,
          user: row.user,
          sprintNumber: day.sprintNumber,
          sprintIsDone: sprintGroup?.isDone ?? false,
          event: seg.event,
          teamId: this.currentUser?.teamId ?? '',
        } as EventInfoDialogData,
        panelClass: 'event-info-dialog-overlay',
        backdropClass: 'add-event-backdrop',
        width: '540px',
        maxWidth: '96vw',
      })
      .afterClosed()
      .subscribe((removed) => {
        if (removed) this.loadCalendar();
      });
  }

  protected readonly getInitials = getInitials;
  protected readonly getAvatarGradient = getAvatarGradient;

  trackBySegment(_: number, seg: RowSegment): string {
    return seg.days[0].date + '_' + seg.type;
  }

  getVacBarTooltip(seg: RowSegment): string {
    if (!seg.event) return '';
    const start = format(parseISO(seg.days[0].date), 'MMM d');
    const end = format(parseISO(seg.days[seg.days.length - 1].date), 'MMM d');
    return start === end ? `Vacation: ${start}` : `Vacation: ${start} – ${end}`;
  }

  trackByDate(_: number, day: CalendarDay): string {
    return day.date;
  }

  trackByUser(_: number, row: MemberRow): string {
    return row.user.uid;
  }
}
