import {
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  format,
  getISOWeek,
  startOfISOWeek,
  endOfISOWeek,
  addWeeks,
  addDays,
  eachDayOfInterval,
  isWeekend,
  differenceInCalendarDays,
  parseISO,
} from 'date-fns';
import { CalendarService } from '../../../core/services/calendar.service';
import { VacationService } from '../../../core/services/vacation.service';
import { TeamService } from '../../../core/services/team.service';
import { AuthService } from '../../../core/services/auth.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { CalendarEvent } from '../../../core/models/event.model';
import { AppUser } from '../../../core/models/user.model';
import { Team } from '../../../core/models/team.model';
import { combineLatest } from 'rxjs';
import { NgApexchartsModule } from 'ng-apexcharts';

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
    MatSnackBarModule,
    NgApexchartsModule,
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit {
  private calendarService = inject(CalendarService);
  private vacationService = inject(VacationService);
  private teamService = inject(TeamService);
  private authService = inject(AuthService);
  private snackBar = inject(MatSnackBar);
  private destroyRef = inject(DestroyRef);

  get currentUser() {
    return this.authService.currentUser;
  }
  todaySummary = signal<TodaySummary[]>([]);
  pendingCount = signal(0);
  loading = signal(true);
  today = format(new Date(), 'EEEE, MMMM d, yyyy');

  teams = signal<Team[]>([]);
  teamsLoading = signal(false);
  actingTeamId = signal<string | null>(null);
  teamError = signal<string | null>(null);

  availableTeams = computed(() => {
    const uid = this.currentUser?.uid ?? '';
    return this.teams().filter((t) => !t.memberIds.includes(uid));
  });

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

  get canApprove(): boolean {
    return (
      this.currentUser?.role === 'admin' || this.currentUser?.role === 'manager'
    );
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

  getStatusLabel(s: TodaySummary): string {
    if (!s.event) return 'Working';
    const map: Record<string, string> = {
      refinement: 'Refinement',
      planning: 'Planning',
      'sprint-review': 'Sprint Review',
      vacation: 'Vacation',
      holiday: 'Holiday',
    };
    return map[s.event.type] ?? 'Working';
  }

  getStatusClass(s: TodaySummary): string {
    if (!s.event) return 'status-working';
    return `status-${s.event.type}`;
  }

  getStatusIcon(s: TodaySummary): string {
    if (!s.event) return 'laptop_mac';
    const map: Record<string, string> = {
      refinement: 'assignment_turned_in',
      planning: 'event_note',
      'sprint-review': 'rate_review',
      vacation: 'beach_access',
      holiday: 'celebration',
    };
    return map[s.event.type] ?? 'laptop_mac';
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

  readonly sprintChartCfg = {
    chart: {
      type: 'radialBar' as const,
      height: 170,
      background: 'transparent',
      sparkline: { enabled: false },
      toolbar: { show: false },
    },
    plotOptions: {
      radialBar: {
        startAngle: -125,
        endAngle: 125,
        hollow: { size: '60%', background: 'transparent' },
        track: { background: 'rgba(99,102,241,0.12)', strokeWidth: '100%' },
        dataLabels: {
          show: true,
          name: { show: false },
          value: {
            offsetY: 6,
            fontSize: '1.5rem',
            fontWeight: '700',
            fontFamily: 'Inter, sans-serif',
            color: '#a5b4fc',
            formatter: (val: any) => `${Math.round(Number(val))}%`,
          },
        },
      },
    },
    fill: {
      type: 'gradient',
      gradient: {
        shade: 'dark',
        type: 'horizontal',
        gradientToColors: ['#818cf8'],
        stops: [0, 100],
      },
    },
    colors: ['#4f46e5'],
    stroke: { lineCap: 'round' as const },
  };

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
    const teamId = this.currentUser?.teamId ?? '';
    const now = new Date();

    if (!teamId) {
      this.loading.set(false);
      this.teamsLoading.set(true);
      this.teamService
        .getAllTeams()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((teams) => {
          this.teams.set(teams);
          this.teamsLoading.set(false);
        });
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

    if (this.canApprove) {
      this.vacationService.getPendingRequests(teamId).subscribe((r) => {
        this.pendingCount.set(r.length);
      });
    }
  }

  async joinTeam(team: Team): Promise<void> {
    const user = this.authService.currentUser;
    if (!user) return;
    this.actingTeamId.set(team.id);
    this.teamError.set(null);
    try {
      await this.teamService.joinTeam(team.id, user.uid, team.memberIds);
      this.authService.patchCurrentUser({ teamId: team.id });
      this.snackBar.open(`Joined "${team.name}"`, 'OK', { duration: 3000 });
      window.location.reload();
    } catch (e: any) {
      this.teamError.set(e?.message ?? 'Failed to join team.');
    } finally {
      this.actingTeamId.set(null);
    }
  }
}
