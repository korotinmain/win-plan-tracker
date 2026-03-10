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

  get onRefinement(): number {
    return this.todaySummary().filter((s) => s.event?.type === 'refinement')
      .length;
  }

  get onPlanning(): number {
    return this.todaySummary().filter((s) => s.event?.type === 'planning')
      .length;
  }

  get onSprintReview(): number {
    return this.todaySummary().filter((s) => s.event?.type === 'sprint-review')
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
            offsetCenter: [0, '15%'],
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
            html += `<span style="color:#10b981">●</span> Working: ${d.working}<br/>`;
          if (d.onCeremony > 0)
            html += `<span style="color:#6366f1">●</span> Ceremony: ${d.onCeremony}<br/>`;
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
          name: 'Working',
          type: 'bar',
          stack: 'total',
          barMaxWidth: 40,
          barCategoryGap: '30%',
          itemStyle: { color: '#10b981', borderRadius: [0, 0, 4, 4] },
          data: days.map((d) => ({
            value: d.working,
            itemStyle: d.weekend
              ? {
                  color: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                  borderRadius: [4, 4, 4, 4],
                }
              : d.isToday
                ? {
                    color: '#10b981',
                    borderColor: '#34d399',
                    borderWidth: 1,
                    borderRadius: [0, 0, 4, 4],
                  }
                : {},
          })),
        },
        {
          name: 'Ceremony',
          type: 'bar',
          stack: 'total',
          barMaxWidth: 40,
          itemStyle: { color: '#6366f1' },
          data: days.map((d) => ({
            value: d.onCeremony,
            itemStyle: d.weekend ? { color: 'transparent' } : {},
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
        dayEvts.some(
          (e) =>
            e.userId === m.uid &&
            ['vacation', 'refinement', 'planning', 'sprint-review'].includes(
              e.type,
            ),
        ),
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
      const ceremony = members.filter((m) =>
        dayEvts.some(
          (e) =>
            e.userId === m.uid &&
            ['planning', 'refinement', 'sprint-review'].includes(e.type),
        ),
      ).length;
      const working = Math.max(0, total - vac - ceremony);
      return {
        dateStr,
        label: format(d, 'EEE d'),
        working,
        ceremony,
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
          if (d.ceremony > 0)
            html += `<span style="color:#6366f1">●</span> Ceremony: ${d.ceremony}<br/>`;
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
          name: 'Ceremony',
          type: 'bar',
          stack: 'cap',
          barMaxWidth: 44,
          itemStyle: { color: '#6366f1' },
          data: cap.days.map((d) => d.ceremony),
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
    const ceremonies = [
      { label: 'Planning', d: sprintStart },
      { label: 'Refinement', d: addDays(sprintStart, 7) },
      { label: 'Sprint Review', d: addDays(sprintStart, 11) },
    ]
      .map((c) => ({
        label: c.label,
        date: format(c.d, 'MMM d'),
        daysAway: differenceInCalendarDays(c.d, today),
      }))
      .filter((c) => c.daysAway >= 0);
    return {
      sprintNumber,
      percent,
      elapsed: elapsedDays.length,
      total: workDays.length,
      remaining,
      startDate: format(sprintStart, 'MMM d'),
      endDate: format(sprintEnd, 'MMM d'),
      nextCeremony: ceremonies[0] ?? null,
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
      const ceremony = !weekend
        ? members.filter((m) =>
            dayEvts.some(
              (e) =>
                e.userId === m.uid &&
                ['planning', 'refinement', 'sprint-review'].includes(e.type),
            ),
          ).length
        : 0;
      const working =
        !weekend && total > 0 ? Math.max(0, total - vac - ceremony) : 0;
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
        onCeremony: ceremony,
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
    const map = new Map<
      string,
      { date: string; type: string; names: string[]; count: number }
    >();
    events.forEach((e) => {
      const key = `${e.date}__${e.type}`;
      if (!map.has(key))
        map.set(key, { date: e.date, type: e.type, names: [], count: 0 });
      const g = map.get(key)!;
      g.count++;
      const m = members.find((x) => x.uid === e.userId);
      if (m) g.names.push(m.displayName.split(' ')[0]);
    });
    const typeLabels: Record<string, string> = {
      refinement: 'Refinement',
      planning: 'Planning',
      'sprint-review': 'Sprint Review',
      vacation: 'Vacation',
    };
    return Array.from(map.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 8)
      .map((g) => {
        const d = parseISO(g.date);
        const daysAway = differenceInCalendarDays(d, new Date());
        return {
          ...g,
          typeLabel: typeLabels[g.type] ?? g.type,
          displayDate: format(d, 'EEE, MMM d'),
          isToday: g.date === todayStr,
          daysAway,
          daysLabel:
            daysAway === 0
              ? 'Today'
              : daysAway === 1
                ? 'Tomorrow'
                : `in ${daysAway}d`,
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
