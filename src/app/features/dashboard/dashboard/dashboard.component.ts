import {
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  OnDestroy,
  signal,
} from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { EChartsOption } from 'echarts';
import {
  format,
  startOfMonth,
  endOfMonth,
  addDays,
  eachDayOfInterval,
  isWeekend,
  getISOWeek,
  differenceInCalendarDays,
  parseISO,
} from 'date-fns';
import { CalendarService } from '../../../core/services/calendar.service';
import { TeamService } from '../../../core/services/team.service';
import { AuthService } from '../../../core/services/auth.service';
import { SprintService } from '../../../core/services/sprint.service';
import { CalendarEvent } from '../../../core/models/event.model';
import { AppUser } from '../../../core/models/user.model';
import { combineLatest } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { getInitials } from '../../../shared/utils/initials.util';
import { getAvatarColor } from '../../../shared/utils/avatar.util';
import {
  KPI_DIALOG_CONFIG,
  EVENTS_DIALOG_CONFIG,
} from '../../../shared/utils/dialog.util';
import { DashboardChartsService } from '../services/dashboard-charts.service';
import {
  KpiDetailDialogComponent,
  KpiType,
} from '../kpi-detail-dialog/kpi-detail-dialog.component';
import {
  UpcomingEventsDialogComponent,
  UpcomingEventRow,
  MemberAvatar,
} from '../upcoming-events-dialog/upcoming-events-dialog.component';
import { TeamSizeDialogComponent } from '../team-size-dialog/team-size-dialog.component';
import { SprintDaysDialogComponent } from '../sprint-days-dialog/sprint-days-dialog.component';

interface TodaySummary {
  user: AppUser;
  event: CalendarEvent | null;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    NgxEchartsDirective,
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit, OnDestroy {
  private calendarService = inject(CalendarService);
  private teamService = inject(TeamService);
  private authService = inject(AuthService);
  private sprintService = inject(SprintService);
  private chartsService = inject(DashboardChartsService);
  private destroyRef = inject(DestroyRef);
  private doc = inject(DOCUMENT);
  private dialog = inject(MatDialog);
  private themeObserver?: MutationObserver;

  isDark = signal(
    this.doc.documentElement.getAttribute('data-theme') === 'dark',
  );

  get currentUser() {
    return this.authService.currentUser;
  }
  todaySummary = signal<TodaySummary[]>([]);
  loading = signal(true);
  today = format(new Date(), 'EEEE, MMMM d, yyyy');

  get hasTeam(): boolean {
    return !!this.currentUser?.teamId;
  }

  get firstName(): string {
    return this.currentUser?.displayName?.split(' ')[0] ?? 'there';
  }

  get initials(): string {
    return getInitials(this.currentUser?.displayName ?? '');
  }

  get timeOfDay(): string {
    const h = new Date().getHours();
    if (h < 12) return 'morning';
    if (h < 17) return 'afternoon';
    return 'evening';
  }

  get working(): number {
    return this.todaySummary().filter(
      (s) => !s.event || s.event.type === 'holiday',
    ).length;
  }

  get onVacation(): number {
    return this.todaySummary().filter((s) => s.event?.type === 'vacation')
      .length;
  }

  // ── ECharts options (delegated to DashboardChartsService) ───
  readonly sprintGaugeOpts = computed(
    (): EChartsOption =>
      this.chartsService.sprintGaugeOpts(
        this.sprintInfo.percent,
        this.isDark(),
      ),
  );

  readonly weekBarOpts = computed(
    (): EChartsOption =>
      this.chartsService.weekBarOpts(this.weekHeatmap(), this.isDark()),
  );

  readonly avgVelocity = computed(() => {
    const data = this.teamVelocity();
    if (!data.length) return 0;
    return Math.round(data.reduce((s, d) => s + d.pct, 0) / data.length);
  });

  // ── Team Velocity (week-by-week availability trend) ────────
  readonly teamVelocity = computed(() => {
    const now = new Date();
    const allDays = eachDayOfInterval({
      start: startOfMonth(now),
      end: endOfMonth(now),
    });
    const workDays = allDays.filter((d) => !isWeekend(d));
    const events = this.allMonthEvents();
    const members = this.allMembers();
    const total = members.length || 1;

    const weeks = new Map<
      number,
      { label: string; available: number; days: number }
    >();
    workDays.forEach((d) => {
      const wk = getISOWeek(d);
      const dateStr = format(d, 'yyyy-MM-dd');
      const dayEvts = events.filter((e) => e.date === dateStr);
      const unavail = members.filter((m) =>
        dayEvts.some((e) => e.userId === m.uid && e.type === 'vacation'),
      ).length;
      if (!weeks.has(wk))
        weeks.set(wk, { label: `W${wk}`, available: 0, days: 0 });
      const entry = weeks.get(wk)!;
      entry.available += total - unavail;
      entry.days++;
    });

    return Array.from(weeks.values()).map((v) => ({
      week: v.label,
      pct: v.days ? Math.round((v.available / v.days / total) * 100) : 0,
      personDays: v.available,
    }));
  });

  // ── Sprint Capacity (per-day breakdown of current sprint) ────
  readonly sprintCapacity = computed(() => {
    const events = this.allMonthEvents();
    const members = this.allMembers();
    const total = members.length;
    if (!total) return null;

    const { startRaw: spStart, endRaw: spEnd } = this.sprintService.getSprintInfo();
    const sprintDays = eachDayOfInterval({ start: spStart, end: spEnd }).filter(
      (d) => !isWeekend(d),
    );

    const days = sprintDays.map((d) => {
      const dateStr = format(d, 'yyyy-MM-dd');
      const dayEvts = events.filter((e) => e.date === dateStr);
      const vac = members.filter((m) =>
        dayEvts.some((e) => e.userId === m.uid && e.type === 'vacation'),
      ).length;
      const working = Math.max(0, total - vac);
      return {
        dateStr,
        label: format(d, 'EEE d'),
        working,
        vacation: vac,
      };
    });

    const totalPersonDays = days.reduce((s, d) => s + d.working, 0);
    const capacityPct = Math.round(
      (totalPersonDays / (sprintDays.length * total)) * 100,
    );
    return {
      days,
      totalPersonDays,
      capacityPct,
      sprintDays: sprintDays.length,
      total,
    };
  });

  readonly velocityChartOpts = computed(
    (): EChartsOption =>
      this.chartsService.velocityChartOpts(this.teamVelocity(), this.isDark()),
  );

  readonly capacityChartOpts = computed((): EChartsOption => {
    const cap = this.sprintCapacity();
    return cap ? this.chartsService.capacityChartOpts(cap, this.isDark()) : {};
  });

  get currentMonthYear(): string {
    return format(new Date(), 'MMMM yyyy');
  }

  openKpiDialog(type: KpiType): void {
    const summary = this.todaySummary();
    const members = this.allMembers();
    const typeMap: Record<KpiType, string> = {
      working: '',
      vacation: 'vacation',
    };

    const activeMembers =
      type === 'working'
        ? summary
            .filter((s) => !s.event || s.event.type === 'holiday')
            .map((s) => ({ user: s.user, event: s.event }))
        : summary
            .filter((s) => s.event?.type === typeMap[type])
            .map((s) => ({ user: s.user, event: s.event }));

    this.dialog.open(KpiDetailDialogComponent, {
      ...KPI_DIALOG_CONFIG,
      data: {
        type,
        activeMembers,
        summary: {
          working: this.working,
          onVacation: this.onVacation,
          total: members.length,
        },
        asOf: new Date(),
      },
    });
  }

  openTeamSizeDialog(): void {
    this.dialog.open(TeamSizeDialogComponent, {
      ...KPI_DIALOG_CONFIG,
      data: {
        members: this.allMembers(),
        working: this.working,
        onVacation: this.onVacation,
        asOf: new Date(),
      },
    });
  }

  openSprintDaysDialog(): void {
    const sp = this.sprintInfo;
    this.dialog.open(SprintDaysDialogComponent, {
      ...KPI_DIALOG_CONFIG,
      data: {
        sprintNumber: sp.sprintNumber,
        remaining: sp.remaining,
        elapsed: sp.elapsed,
        total: sp.total,
        percent: sp.percent,
        startDate: sp.startDate,
        endDate: sp.endDate,
        sprintStartRaw: sp.startRaw,
        sprintEndRaw: sp.endRaw,
        asOf: new Date(),
      },
    });
  }

  openEventsDialog(): void {
    const members = this.allMembers();
    const rawEvents = this.allMonthEvents();
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    const sp = this.sprintInfo;

    // Group vacation dates per member
    const byMember = new Map<string, string[]>();
    rawEvents
      .filter((e) => e.date >= todayStr && e.type === 'vacation')
      .forEach((e) => {
        if (!byMember.has(e.userId)) byMember.set(e.userId, []);
        byMember.get(e.userId)!.push(e.date);
      });

    const rows: UpcomingEventRow[] = [];

    byMember.forEach((dates, userId) => {
      const sorted = [...new Set(dates)].sort();

      // Merge runs bridging weekends (gap ≤ 3 days = Fri→Mon)
      const runs: string[][] = [];
      let current: string[] = [];
      sorted.forEach((d, i) => {
        if (i === 0) {
          current.push(d);
          return;
        }
        const diff = differenceInCalendarDays(
          parseISO(d),
          parseISO(sorted[i - 1]),
        );
        if (diff <= 3) {
          current.push(d);
        } else {
          runs.push(current);
          current = [d];
        }
      });
      if (current.length) runs.push(current);

      const m = members.find((x) => x.uid === userId);
      const av: MemberAvatar = m
        ? {
            initials: getInitials(m.displayName),
            color: getAvatarColor(userId),
            name: m.displayName,
          }
        : { initials: '?', color: '#64748b', name: 'Unknown' };

      runs.forEach((run) => {
        const startDate = run[0];
        const endDate = run[run.length - 1];
        const startD = parseISO(startDate);
        const endD = parseISO(endDate);
        const daysAway = differenceInCalendarDays(startD, today);
        const sameMonth = startD.getMonth() === endD.getMonth();
        const displayDate =
          run.length === 1
            ? format(startD, 'EEE, MMM d')
            : sameMonth
              ? `${format(startD, 'MMM d')} – ${format(endD, 'd')}`
              : `${format(startD, 'MMM d')} – ${format(endD, 'MMM d')}`;

        rows.push({
          key: `${userId}__${startDate}__${endDate}`,
          date: startDate,
          type: 'vacation',
          typeLabel: 'Vacation',
          category: 'Vacation',
          accentColor: '#6366f1',
          displayDate,
          isToday: daysAway === 0,
          daysAway,
          daysLabel:
            daysAway === 0
              ? 'Today'
              : daysAway === 1
                ? 'Tomorrow'
                : `In ${daysAway}d`,
          memberAvatars: [av],
        });
      });
    });

    rows.sort((a, b) => a.date.localeCompare(b.date));

    const sprintEndStr = format(sp.endRaw, 'yyyy-MM-dd');
    const sprintVacationCount = rows.filter(
      (r) => r.date <= sprintEndStr,
    ).length;

    this.dialog.open(UpcomingEventsDialogComponent, {
      ...EVENTS_DIALOG_CONFIG,
      data: {
        rows,
        sprintNumber: sp.sprintNumber,
        currentMonth: this.currentMonthYear,
        sprintVacationCount,
      },
    });
  }

  // ── Raw data ─────────────────────────────────────────────────
  allMonthEvents = signal<CalendarEvent[]>([]);
  allMembers = signal<AppUser[]>([]);

  // ── Sprint Progress (delegated to SprintService) ────────────
  get sprintInfo() {
    return this.sprintService.getSprintInfo();
  }

  // ── Weekly Heatmap ───────────────────────────────────────────
  weekHeatmap = computed(() => {
    const now = new Date();
    const weekStart = startOfISOWeek(now);
    const allWeekDays = eachDayOfInterval({
      start: weekStart,
      end: addDays(weekStart, 6),
    });
    const todayStr = format(now, 'yyyy-MM-dd');
    const events = this.allMonthEvents();
    const members = this.allMembers();
    const total = members.length;
    return allWeekDays.map((d) => {
      const dateStr = format(d, 'yyyy-MM-dd');
      const weekend = isWeekend(d);
      const dayEvts = events.filter((e) => e.date === dateStr);
      const vac = !weekend
        ? members.filter((m) =>
            dayEvts.some((e) => e.userId === m.uid && e.type === 'vacation'),
          ).length
        : 0;
      const working = !weekend && total > 0 ? Math.max(0, total - vac) : 0;
      const availPct =
        !weekend && total > 0 ? Math.round((working / total) * 100) : 0;
      return {
        dateStr,
        label: format(d, 'EEE'),
        dayNum: format(d, 'd'),
        isToday: dateStr === todayStr,
        weekend,
        total,
        working,
        onVacation: vac,
        availPct,
      };
    });
  });

  // ── Upcoming Events ──────────────────────────────────────────
  upcomingEvents = computed(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const events = this.allMonthEvents().filter(
      (e) => e.date >= todayStr && e.type !== 'holiday',
    );
    const members = this.allMembers();

    // Group events by userId
    const byUser = new Map<string, CalendarEvent[]>();
    events.forEach((e) => {
      if (!byUser.has(e.userId)) byUser.set(e.userId, []);
      byUser.get(e.userId)!.push(e);
    });

    // Find consecutive runs per user
    interface Block {
      userId: string;
      type: string;
      startDate: string;
      endDate: string;
      days: number;
    }
    const blocks: Block[] = [];
    byUser.forEach((userEvents, userId) => {
      const sorted = [...userEvents].sort((a, b) =>
        a.date.localeCompare(b.date),
      );
      let runStart = sorted[0];
      let runEnd = sorted[0];
      let runDays = 1;
      for (let i = 1; i < sorted.length; i++) {
        const prev = parseISO(runEnd.date);
        const curr = parseISO(sorted[i].date);
        const gapStart = addDays(prev, 1);
        const gapEnd = addDays(curr, -1);
        const workdaysBetween =
          gapStart <= gapEnd
            ? eachDayOfInterval({ start: gapStart, end: gapEnd }).filter(
                (d) => !isWeekend(d),
              ).length
            : 0;
        if (workdaysBetween === 0 && sorted[i].type === runStart.type) {
          runEnd = sorted[i];
          runDays++;
        } else {
          blocks.push({
            userId,
            type: runStart.type,
            startDate: runStart.date,
            endDate: runEnd.date,
            days: runDays,
          });
          runStart = sorted[i];
          runEnd = sorted[i];
          runDays = 1;
        }
      }
      blocks.push({
        userId,
        type: runStart.type,
        startDate: runStart.date,
        endDate: runEnd.date,
        days: runDays,
      });
    });

    const typeLabels: Record<string, string> = { vacation: 'Vacation' };
    return blocks
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .slice(0, 8)
      .map((block) => {
        const d = parseISO(block.startDate);
        const daysAway = differenceInCalendarDays(d, new Date());
        const member = members.find((m) => m.uid === block.userId);
        const firstName = member?.displayName.split(' ')[0] ?? '';
        const multiDay = block.startDate !== block.endDate;
        const endFmt = multiDay
          ? format(parseISO(block.endDate), 'd MMM')
          : null;
        return {
          date: block.startDate,
          type: block.type,
          typeLabel: typeLabels[block.type] ?? block.type,
          displayDate: multiDay
            ? `${format(d, 'EEE, d MMM')} – ${endFmt}`
            : format(d, 'EEE, d MMM'),
          isToday: block.startDate === todayStr,
          daysAway,
          daysLabel:
            daysAway === 0
              ? 'Today'
              : daysAway === 1
                ? 'Tomorrow'
                : `in ${daysAway}d`,
          names: firstName ? [firstName] : [],
          count: block.days,
        };
      });
  });

  ngOnInit(): void {
    const html = this.doc.documentElement;
    this.themeObserver = new MutationObserver(() => {
      this.isDark.set(html.getAttribute('data-theme') === 'dark');
    });
    this.themeObserver.observe(html, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    const teamId = this.currentUser?.teamId ?? '';
    const now = new Date();

    if (!teamId) {
      this.loading.set(false);
      return;
    }

    combineLatest([
      this.calendarService.getTeamEvents(
        teamId,
        now.getFullYear(),
        now.getMonth() + 1,
      ),
    ])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(async ([events]) => {
      try {
        const members = await this.teamService.getTeamMembers(teamId);
        this.allMonthEvents.set(events);
        this.allMembers.set(members);
        const todayStr = format(now, 'yyyy-MM-dd');
        this.todaySummary.set(
          members.map((user) => ({
            user,
            event:
              events.find((e) => e.userId === user.uid && e.date === todayStr) ??
              null,
          }))
        );
      } catch (e) {
        console.error('[Dashboard] Failed to load team data', e);
      } finally {
        this.loading.set(false);
      }
    });
  }

  ngOnDestroy(): void {
    this.themeObserver?.disconnect();
  }
}
