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
import { AppUser } from '../../../core/models/user.model';
import { combineLatest, map } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

interface CalendarDay {
  date: string; // YYYY-MM-DD
  display: string; // e.g. "Mon, Apr 20"
  weekNumber: number;
  isWeekend: boolean;
  isHoliday: boolean;
  holidayName?: string;
  isFirstOfWeek: boolean;
  weekRowspan: number; // how many days share this week number
  sprintNumber: number; // sprint N = ISO weeks 2N-1 and 2N
  isFirstOfSprint: boolean;
  sprintDateRange: string; // e.g. "Mar 9 – Mar 22" (only when isFirstOfSprint)
  /** Fixed team ceremony computed from sprint structure — never stored in Firestore */
  sprintEvent?: 'planning' | 'refinement' | 'sprint-review';
}

interface MemberRow {
  user: AppUser;
  cells: Map<string, CalendarEvent | null>; // date -> event
}

@Component({
  selector: 'app-calendar-grid',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
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

        // Sprint = 2 ISO weeks; sprint N covers weeks (2N-1) and 2N.
        // First pass: compute sprint date ranges visible in this month.
        const sprintFirstDate = new Map<number, Date>();
        const sprintLastDate = new Map<number, Date>();
        allDays.forEach((d) => {
          const sprint = Math.ceil(getISOWeek(d) / 2);
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
          const sprint = Math.ceil(week / 2);
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
          // Compute fixed sprint ceremonies from day-of-week + ISO week position
          const firstWeekOfSprint = 2 * sprint - 1; // odd week = first week of sprint
          const secondWeekOfSprint = 2 * sprint; // even week = second week of sprint
          const dow = d.getDay(); // 0=Sun,1=Mon,5=Fri
          let sprintEvent:
            | 'planning'
            | 'refinement'
            | 'sprint-review'
            | undefined;
          if (dow === 1 && week === firstWeekOfSprint) sprintEvent = 'planning';
          else if (dow === 1 && week === secondWeekOfSprint)
            sprintEvent = 'refinement';
          else if (dow === 5 && week === secondWeekOfSprint)
            sprintEvent = 'sprint-review';

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
            sprintEvent,
          });
        });
        this.days.set(calDays);

        // Build member rows with event cells
        const rows: MemberRow[] = members.map((user) => {
          const cells = new Map<string, CalendarEvent | null>();
          calDays.forEach((d) => cells.set(d.date, null));
          events
            .filter((e) => e.userId === user.uid)
            .forEach((e) => cells.set(e.date, e));
          return { user, cells };
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

  getEvent(row: MemberRow, date: string): CalendarEvent | null {
    return row.cells.get(date) ?? null;
  }

  getCellClass(row: MemberRow, day: CalendarDay): string {
    if (day.isWeekend) return 'cell-weekend';
    if (day.isHoliday) return 'cell-holiday';
    const evt = this.getEvent(row, day.date);
    // Vacation takes priority over ceremony
    if (evt?.type === 'vacation') return 'cell-vacation';
    // Fixed sprint ceremonies apply team-wide
    if (day.sprintEvent) return `cell-${day.sprintEvent}`;
    if (!evt) return 'cell-workday';
    switch (evt.type) {
      case 'refinement':
        return 'cell-refinement';
      case 'planning':
        return 'cell-planning';
      case 'sprint-review':
        return 'cell-sprint-review';
      default:
        return 'cell-workday';
    }
  }

  getCellLabel(row: MemberRow, day: CalendarDay): string {
    if (day.isWeekend) return 'weekend';
    if (day.isHoliday) return day.holidayName ?? 'Holiday';
    const evt = this.getEvent(row, day.date);
    // Vacation overrides ceremony label
    if (evt?.type === 'vacation') return 'Vacation';
    // Fixed sprint ceremonies
    if (day.sprintEvent === 'planning') return 'Planning';
    if (day.sprintEvent === 'refinement') return 'Refinement';
    if (day.sprintEvent === 'sprint-review') return 'Sprint Review';
    if (!evt) return '';
    switch (evt.type) {
      case 'refinement':
        return 'Refinement';
      case 'planning':
        return 'Planning';
      case 'sprint-review':
        return 'Sprint Review';
      default:
        return '';
    }
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

  openAddEventDialog(): void {
    const ref = this.dialog.open(AddEventDialogComponent, {
      data: {
        members: this.members(),
        teamId: this.currentUser?.teamId ?? '',
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

  getCellEventType(row: MemberRow, day: CalendarDay): string {
    if (day.isWeekend || day.isHoliday) return '';
    const evt = this.getEvent(row, day.date);
    if (evt?.type === 'vacation') return 'vacation';
    if (day.sprintEvent) return day.sprintEvent;
    return evt?.type ?? '';
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

  getShortLabel(row: MemberRow, day: CalendarDay): string {
    if (day.isWeekend || day.isHoliday) return '';
    const evt = this.getEvent(row, day.date);
    if (evt?.type === 'vacation') return 'Vac';
    if (day.sprintEvent === 'planning') return 'Plan';
    if (day.sprintEvent === 'refinement') return 'Rfmt';
    if (day.sprintEvent === 'sprint-review') return 'SR';
    if (!evt) return '';
    const map: Record<string, string> = {
      refinement: 'Rfmt',
      planning: 'Plan',
      'sprint-review': 'SR',
    };
    return map[evt.type] ?? '';
  }

  trackByDate(_: number, day: CalendarDay): string {
    return day.date;
  }

  trackByUser(_: number, row: MemberRow): string {
    return row.user.uid;
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
}
