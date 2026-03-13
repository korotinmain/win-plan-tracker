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
  getISOWeek,
  startOfISOWeek,
  endOfISOWeek,
  startOfMonth,
  endOfMonth,
  addWeeks,
  addDays,
  eachDayOfInterval,
  isWeekend,
  differenceInCalendarDays,
  parseISO,
} from 'date-fns';
import { CalendarService } from '../../../core/services/calendar.service';
import { TeamService } from '../../../core/services/team.service';
import { AuthService } from '../../../core/services/auth.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CalendarEvent } from '../../../core/models/event.model';
import { AppUser } from '../../../core/models/user.model';
import { combineLatest } from 'rxjs';
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
    return this.getInitials(this.currentUser?.displayName ?? '');
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

  // ── ECharts options ──────────────────────────────────────────
  readonly sprintGaugeOpts = computed((): EChartsOption => {
    const dark = this.isDark();
    const pct = this.sprintInfo.percent;
    return {
      backgroundColor: 'transparent',
      series: [
        {
          type: 'gauge',
          startAngle: 205,
          endAngle: -25,
          min: 0,
          max: 100,
          pointer: { show: false },
          progress: {
            show: true,
            overlap: false,
            roundCap: true,
            width: 14,
            itemStyle: {
              color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 1,
                y2: 0,
                colorStops: [
                  { offset: 0, color: '#4f46e5' },
                  { offset: 1, color: '#818cf8' },
                ],
              } as any,
            },
          },
          axisLine: {
            roundCap: true,
            lineStyle: {
              width: 14,
              color: [
                [1, dark ? 'rgba(99,102,241,0.18)' : 'rgba(99,102,241,0.1)'],
              ],
            },
          },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          anchor: { show: false } as any,
          detail: {
            valueAnimation: true,
            formatter: (val: number) => Math.round(val) + '%',
            color: dark ? '#818cf8' : '#4f46e5',
            fontSize: 30,
            fontWeight: 'bold',
            fontFamily: 'Inter, sans-serif',
            offsetCenter: [0, '-5%'],
          },
          title: { show: false },
          data: [{ value: pct }],
        },
      ] as any,
    };
  });

  readonly weekBarOpts = computed((): EChartsOption => {
    const dark = this.isDark();
    const days = this.weekHeatmap();
    const total = days[0]?.total || 1;
    const textColor = dark ? '#94a3b8' : '#64748b';
    const tooltipBg = dark ? '#1e293b' : '#ffffff';
    const tooltipBorder = dark ? 'rgba(255,255,255,0.1)' : '#e2e8f0';
    const tooltipText = dark ? '#f1f5f9' : '#0f172a';
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow',
          shadowStyle: {
            color: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
          },
        },
        backgroundColor: tooltipBg,
        borderColor: tooltipBorder,
        textStyle: {
          color: tooltipText,
          fontFamily: 'Inter, sans-serif',
          fontSize: 12,
        },
        formatter: (params: any) => {
          const d = days[params[0].dataIndex];
          if (d.weekend) return `<b>${d.label} ${d.dayNum}</b><br/>Weekend`;
          let html = `<b>${d.label}, ${d.dayNum}</b><br/>`;
          if (d.working > 0)
            html += `<span style="color:#10b981">●</span> Available: ${d.working}<br/>`;
          if (d.onVacation > 0)
            html += `<span style="color:#7c3aed">●</span> Vacation: ${d.onVacation}<br/>`;
          return html;
        },
      },
      grid: { left: 4, right: 4, top: 4, bottom: 20, containLabel: false },
      xAxis: {
        type: 'category',
        data: days.map((d) => `${d.label}\n${d.dayNum}`),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: textColor,
          fontSize: 11,
          fontFamily: 'Inter, sans-serif',
          fontWeight: 'bold',
          interval: 0,
          rich: { day: { color: textColor, fontSize: 11 } },
        },
      },
      yAxis: { type: 'value', max: total, show: false },
      series: [
        {
          name: 'Available',
          type: 'bar',
          stack: 'total',
          barMaxWidth: 40,
          barCategoryGap: '30%',
          itemStyle: { color: '#6366f1', borderRadius: [0, 0, 4, 4] },
          data: days.map((d) => ({
            value: d.working,
            itemStyle: d.weekend
              ? {
                  color: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                  borderRadius: [4, 4, 4, 4],
                }
              : d.isToday
                ? {
                    color: '#6366f1',
                    borderColor: '#818cf8',
                    borderWidth: 1,
                    borderRadius: [0, 0, 4, 4],
                  }
                : {},
          })),
        },
        {
          name: 'Vacation',
          type: 'bar',
          stack: 'total',
          barMaxWidth: 40,
          itemStyle: { color: '#7c3aed', borderRadius: [4, 4, 0, 0] },
          data: days.map((d) => ({
            value: d.onVacation,
            itemStyle: d.weekend ? { color: 'transparent' } : {},
          })),
        },
      ] as any,
    };
  });

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

    const now = new Date();
    const isoWeek = getISOWeek(now);
    const isSecondHalf = isoWeek % 2 === 0;
    const spStart = isSecondHalf
      ? startOfISOWeek(addWeeks(now, -1))
      : startOfISOWeek(now);
    const spEnd = endOfISOWeek(addWeeks(spStart, 1));
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

  // ── Velocity ECharts ─────────────────────────────────────────
  readonly velocityChartOpts = computed((): EChartsOption => {
    const dark = this.isDark();
    const data = this.teamVelocity();
    const textColor = dark ? '#94a3b8' : '#64748b';
    const gridColor = dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
    const tooltipBg = dark ? '#1e293b' : '#ffffff';
    const tooltipBorder = dark ? 'rgba(255,255,255,0.1)' : '#e2e8f0';
    const tooltipText = dark ? '#f1f5f9' : '#0f172a';
    return {
      backgroundColor: 'transparent',
      grid: { left: 40, right: 16, top: 12, bottom: 24 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: tooltipBg,
        borderColor: tooltipBorder,
        textStyle: {
          color: tooltipText,
          fontFamily: 'Inter, sans-serif',
          fontSize: 12,
        },
        formatter: (params: any) => {
          const p = params[0];
          return `<b>${p.name}</b><br/>Availability: <b>${p.value}%</b><br/>Person-days: <b>${data[p.dataIndex]?.personDays}</b>`;
        },
      },
      xAxis: {
        type: 'category',
        data: data.map((d) => d.week),
        axisLine: { lineStyle: { color: gridColor } },
        axisTick: { show: false },
        axisLabel: {
          color: textColor,
          fontSize: 11,
          fontFamily: 'Inter, sans-serif',
          fontWeight: 'bold',
        },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 100,
        interval: 25,
        splitLine: { lineStyle: { color: gridColor } },
        axisLabel: {
          color: textColor,
          fontSize: 10,
          fontFamily: 'Inter, sans-serif',
          formatter: '{value}%',
        },
      },
      series: [
        {
          name: 'Availability',
          type: 'line',
          smooth: true,
          symbolSize: 8,
          symbol: 'circle',
          data: data.map((d) => d.pct),
          itemStyle: {
            color: '#10b981',
            borderWidth: 2,
            borderColor: dark ? '#111827' : '#ffffff',
          },
          lineStyle: { color: '#10b981', width: 3 },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                {
                  offset: 0,
                  color: dark
                    ? 'rgba(16,185,129,0.40)'
                    : 'rgba(16,185,129,0.22)',
                },
                { offset: 1, color: 'rgba(16,185,129,0.02)' },
              ],
            } as any,
          },
          markLine: {
            silent: true,
            symbol: 'none',
            data: [{ type: 'average', name: 'Avg' }],
            lineStyle: {
              color: '#10b981',
              type: 'dashed',
              width: 1,
              opacity: 0.5,
            },
            label: {
              formatter: 'avg {c}%',
              color: '#10b981',
              fontSize: 10,
              fontFamily: 'Inter, sans-serif',
            },
          },
        },
      ] as any,
    };
  });

  // ── Capacity ECharts ─────────────────────────────────────────
  readonly capacityChartOpts = computed((): EChartsOption => {
    const dark = this.isDark();
    const cap = this.sprintCapacity();
    if (!cap) return {};
    const textColor = dark ? '#94a3b8' : '#64748b';
    const tooltipBg = dark ? '#1e293b' : '#ffffff';
    const tooltipBorder = dark ? 'rgba(255,255,255,0.1)' : '#e2e8f0';
    const tooltipText = dark ? '#f1f5f9' : '#0f172a';
    return {
      backgroundColor: 'transparent',
      grid: { left: 4, right: 4, top: 4, bottom: 22, containLabel: false },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: tooltipBg,
        borderColor: tooltipBorder,
        textStyle: {
          color: tooltipText,
          fontFamily: 'Inter, sans-serif',
          fontSize: 12,
        },
        formatter: (params: any) => {
          const d = cap.days[params[0].dataIndex];
          let html = `<b>${d.label}</b><br/>`;
          if (d.working > 0)
            html += `<span style="color:#10b981">●</span> Working: ${d.working}<br/>`;
          if (d.vacation > 0)
            html += `<span style="color:#7c3aed">●</span> Vacation: ${d.vacation}<br/>`;
          return html;
        },
      },
      xAxis: {
        type: 'category',
        data: cap.days.map((d) => d.label),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: textColor,
          fontSize: 10,
          fontFamily: 'Inter, sans-serif',
          fontWeight: 'bold',
          interval: 0,
        },
      },
      yAxis: { type: 'value', max: cap.total, show: false },
      series: [
        {
          name: 'Working',
          type: 'bar',
          stack: 'cap',
          barMaxWidth: 44,
          barCategoryGap: '28%',
          itemStyle: { color: '#10b981', borderRadius: [0, 0, 4, 4] },
          data: cap.days.map((d) => d.working),
        },
        {
          name: 'Vacation',
          type: 'bar',
          stack: 'cap',
          barMaxWidth: 44,
          itemStyle: { color: '#7c3aed', borderRadius: [4, 4, 0, 0] },
          data: cap.days.map((d) => d.vacation),
        },
      ] as any,
    };
  });

  get currentMonthYear(): string {
    return format(new Date(), 'MMMM yyyy');
  }

  openKpiDialog(type: KpiType): void {
    const today = format(new Date(), 'yyyy-MM-dd');
    const summary = this.todaySummary();
    const members = this.allMembers();

    let activeMembers: { user: AppUser; event: CalendarEvent | null }[];
    if (type === 'working') {
      activeMembers = summary
        .filter((s) => !s.event || s.event.type === 'holiday')
        .map((s) => ({ user: s.user, event: s.event }));
    } else {
      const typeMap: Record<KpiType, string> = {
        working: '',
        vacation: 'vacation',
      };
      activeMembers = summary
        .filter((s) => s.event?.type === typeMap[type])
        .map((s) => ({ user: s.user, event: s.event }));
    }

    this.dialog.open(KpiDetailDialogComponent, {
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
      panelClass: 'kpi-dialog-panel',
      backdropClass: 'kpi-dialog-backdrop',
      maxWidth: '95vw',
    });
  }

  openTeamSizeDialog(): void {
    const members = this.allMembers();
    this.dialog.open(TeamSizeDialogComponent, {
      data: {
        members,
        working: this.working,
        onVacation: this.onVacation,
        asOf: new Date(),
      },
      panelClass: 'kpi-dialog-panel',
      backdropClass: 'kpi-dialog-backdrop',
      maxWidth: '95vw',
    });
  }

  openSprintDaysDialog(): void {
    const now = new Date();
    const isoWeek = getISOWeek(now);
    const isSecondHalf = isoWeek % 2 === 0;
    const sprintStart = isSecondHalf
      ? startOfISOWeek(addWeeks(now, -1))
      : startOfISOWeek(now);
    const sprintEnd = endOfISOWeek(addWeeks(sprintStart, 1));
    const sp = this.sprintInfo;
    this.dialog.open(SprintDaysDialogComponent, {
      data: {
        sprintNumber: sp.sprintNumber,
        remaining: sp.remaining,
        elapsed: sp.elapsed,
        total: sp.total,
        percent: sp.percent,
        startDate: sp.startDate,
        endDate: sp.endDate,
        sprintStartRaw: sprintStart,
        sprintEndRaw: sprintEnd,
        asOf: now,
      },
      panelClass: 'kpi-dialog-panel',
      backdropClass: 'kpi-dialog-backdrop',
      maxWidth: '95vw',
    });
  }

  openEventsDialog(): void {
    const members = this.allMembers();
    const rawEvents = this.allMonthEvents();
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');

    const ACCENT_COLOR = '#6366f1';
    const AVATAR_PALETTE = [
      '#6366f1',
      '#8b5cf6',
      '#ec4899',
      '#f59e0b',
      '#10b981',
      '#06b6d4',
      '#ef4444',
    ];

    // Collect future vacation dates per member
    const byMember = new Map<string, string[]>();
    rawEvents
      .filter((e) => e.date >= todayStr && e.type === 'vacation')
      .forEach((e) => {
        if (!byMember.has(e.userId)) byMember.set(e.userId, []);
        byMember.get(e.userId)!.push(e.date);
      });

    const rows: UpcomingEventRow[] = [];

    byMember.forEach((dates, userId) => {
      // Deduplicate and sort
      const sorted = [...new Set(dates)].sort();

      // Group into consecutive runs — allow gap ≤ 3 days to bridge weekends (Fri→Mon = 3)
      const runs: string[][] = [];
      let current: string[] = [];
      sorted.forEach((dateStr, i) => {
        if (i === 0) {
          current.push(dateStr);
          return;
        }
        const diff = differenceInCalendarDays(
          parseISO(dateStr),
          parseISO(sorted[i - 1]),
        );
        if (diff <= 3) {
          current.push(dateStr);
        } else {
          runs.push(current);
          current = [dateStr];
        }
      });
      if (current.length) runs.push(current);

      const m = members.find((x) => x.uid === userId);
      const hash = userId
        .split('')
        .reduce((acc, c) => acc + c.charCodeAt(0), 0);
      const av: MemberAvatar = m
        ? {
            initials: this.getInitials(m.displayName),
            color: AVATAR_PALETTE[hash % AVATAR_PALETTE.length],
            name: m.displayName,
          }
        : { initials: '?', color: '#64748b', name: 'Unknown' };

      runs.forEach((run) => {
        const startDate = run[0];
        const endDate = run[run.length - 1];
        const startD = parseISO(startDate);
        const endD = parseISO(endDate);
        const daysAway = differenceInCalendarDays(startD, today);
        const isSameMonth = startD.getMonth() === endD.getMonth();
        const displayDate =
          run.length === 1
            ? format(startD, 'EEE, MMM d')
            : isSameMonth
              ? `${format(startD, 'MMM d')} – ${format(endD, 'd')}`
              : `${format(startD, 'MMM d')} – ${format(endD, 'MMM d')}`;

        rows.push({
          key: `${userId}__${startDate}__${endDate}`,
          date: startDate,
          type: 'vacation',
          typeLabel: 'Vacation',
          category: 'Vacation',
          accentColor: ACCENT_COLOR,
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

    const isoWeek = getISOWeek(today);
    const isSecondHalf = isoWeek % 2 === 0;
    const sprintStart = isSecondHalf
      ? startOfISOWeek(addWeeks(today, -1))
      : startOfISOWeek(today);
    const sprintEnd = endOfISOWeek(addWeeks(sprintStart, 1));
    const sprintEndStr = format(sprintEnd, 'yyyy-MM-dd');
    const sprintVacationCount = rows.filter(
      (r) => r.date <= sprintEndStr,
    ).length;

    this.dialog.open(UpcomingEventsDialogComponent, {
      data: {
        rows,
        sprintNumber: this.sprintInfo.sprintNumber,
        currentMonth: this.currentMonthYear,
        sprintVacationCount,
      },
      panelClass: 'kpi-dialog-panel',
      backdropClass: 'kpi-dialog-backdrop',
      maxWidth: '95vw',
      width: '560px',
    });
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

  // ── Raw data ─────────────────────────────────────────────────
  allMonthEvents = signal<CalendarEvent[]>([]);
  allMembers = signal<AppUser[]>([]);

  // ── Sprint Progress ──────────────────────────────────────────
  get sprintInfo() {
    const now = new Date();
    const isoWeek = getISOWeek(now);
    const sprintNumber = Math.ceil(isoWeek / 2);
    const isSecondHalf = isoWeek % 2 === 0;
    const sprintStart = isSecondHalf
      ? startOfISOWeek(addWeeks(now, -1))
      : startOfISOWeek(now);
    const sprintEnd = endOfISOWeek(addWeeks(sprintStart, 1));
    const allDays = eachDayOfInterval({ start: sprintStart, end: sprintEnd });
    const workDays = allDays.filter((d) => !isWeekend(d));
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const elapsedDays = workDays.filter((d) => {
      const dd = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      return dd <= today;
    });
    const percent = workDays.length
      ? Math.min(100, Math.round((elapsedDays.length / workDays.length) * 100))
      : 0;
    const remaining = workDays.length - elapsedDays.length;
    return {
      sprintNumber,
      percent,
      elapsed: elapsedDays.length,
      total: workDays.length,
      remaining,
      startDate: format(sprintStart, 'MMM d'),
      endDate: format(sprintEnd, 'MMM d'),
    };
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
    ]).subscribe(async ([events]) => {
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
        })),
      );
      this.loading.set(false);
    });
  }

  ngOnDestroy(): void {
    this.themeObserver?.disconnect();
  }
}
