import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { format } from 'date-fns';
import { CalendarService } from '../../../core/services/calendar.service';
import { VacationService } from '../../../core/services/vacation.service';
import { TeamService } from '../../../core/services/team.service';
import { AuthService } from '../../../core/services/auth.service';
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
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit {
  private calendarService = inject(CalendarService);
  private vacationService = inject(VacationService);
  private teamService = inject(TeamService);
  private authService = inject(AuthService);

  currentUser = this.authService.currentUser;
  todaySummary = signal<TodaySummary[]>([]);
  pendingCount = signal(0);
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

  get onActivity(): number {
    return this.todaySummary().filter((s) => s.event?.type === 'activity')
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
      activity: 'Activity',
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
      activity: 'work_outline',
      refinement: 'assignment_turned_in',
      planning: 'event_note',
      'sprint-review': 'rate_review',
      vacation: 'beach_access',
      holiday: 'celebration',
    };
    return map[s.event.type] ?? 'laptop_mac';
  }

  ngOnInit(): void {
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
}
