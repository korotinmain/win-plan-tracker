import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { switchMap, combineLatest, of, map } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { TeamService } from '../../../core/services/team.service';
import { CalendarService } from '../../../core/services/calendar.service';
import { PresenceService } from '../../../core/services/presence.service';
import { Team } from '../../../core/models/team.model';
import { AppUser } from '../../../core/models/user.model';
import { CalendarEvent } from '../../../core/models/event.model';
import { ManageTeamDialogComponent } from '../manage-team-dialog/manage-team-dialog.component';

const AVATAR_COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#ef4444',
  '#06b6d4',
];

@Component({
  selector: 'app-teams',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatTooltipModule,
  ],
  templateUrl: './teams.component.html',
  styleUrls: ['./teams.component.scss'],
})
export class TeamsComponent {
  private authService = inject(AuthService);
  private teamService = inject(TeamService);
  private calendarService = inject(CalendarService);
  private presenceService = inject(PresenceService);
  private dialog = inject(MatDialog);
  private destroyRef = inject(DestroyRef);

  currentUser = signal<AppUser | null>(this.authService.currentUser);

  members = signal<AppUser[]>([]);
  teams = signal<Team[]>([]);
  events = signal<CalendarEvent[]>([]);
  onlineUids = signal<Set<string>>(new Set());
  loading = signal(true);
  searchQuery = signal('');
  joining = signal<string | null>(null);
  joinError = signal<string | null>(null);
  joinSuccess = signal<string | null>(null);
  joinSearchQuery = signal('');

  filteredJoinTeams = computed(() => {
    const q = this.joinSearchQuery().toLowerCase().trim();
    if (!q) return this.teams();
    return this.teams().filter((t) => t.name.toLowerCase().includes(q));
  });

  hasTeam = computed(() => !!this.currentUser()?.teamId);

  filteredMembers = computed(() => {
    const q = this.searchQuery().toLowerCase();
    if (!q) return this.members();
    return this.members().filter(
      (m) =>
        m.displayName.toLowerCase().includes(q) ||
        m.role.toLowerCase().includes(q),
    );
  });

  totalEvents = computed(() => this.events().length);

  totalSprints = computed(
    () =>
      this.events().filter(
        (e) => e.type === 'planning' || e.type === 'sprint-review',
      ).length,
  );

  onlineCount = computed(
    () => this.members().filter((m) => this.onlineUids().has(m.uid)).length,
  );

  isOnline(uid: string): boolean {
    return this.onlineUids().has(uid);
  }

  memberEventCount(uid: string): number {
    return this.events().filter((e) => e.userId === uid).length;
  }

  memberSprintCount(uid: string): number {
    return this.events().filter(
      (e) =>
        e.userId === uid &&
        (e.type === 'planning' || e.type === 'sprint-review'),
    ).length;
  }

  isAdminOrManager(): boolean {
    const role = this.currentUser()?.role;
    return role === 'admin' || role === 'manager';
  }

  constructor() {
    this.loadMembers();

    this.authService.currentUser$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((u) => this.currentUser.set(u));

    this.presenceService.onlineUids$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((uids) => this.onlineUids.set(uids));

    this.teamService
      .getAllTeams()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap((teams) => {
          this.teams.set(teams);
          if (teams.length === 0) return of([] as CalendarEvent[]);
          return combineLatest(
            teams.map((t) => this.calendarService.getTeamAllEvents(t.id)),
          ).pipe(map((arr) => arr.flat()));
        }),
      )
      .subscribe((events) => this.events.set(events));
  }

  private async loadMembers(): Promise<void> {
    try {
      const users = await this.teamService.getAllUsers();
      this.members.set(users);
    } finally {
      this.loading.set(false);
    }
  }

  initials(name: string): string {
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

  avatarColor(uid: string): string {
    let hash = 0;
    for (let i = 0; i < uid.length; i++)
      hash = uid.charCodeAt(i) + ((hash << 5) - hash);
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  }

  sinceLabel(member: AppUser): string {
    if (!member.createdAt) return '';
    const raw = member.createdAt as any;
    const date = raw?.toDate?.() ?? new Date(raw);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      year: 'numeric',
    }).format(date);
  }

  openAddMember(): void {
    const firstTeam = this.teams()[0];
    if (!firstTeam) return;
    this.dialog.open(ManageTeamDialogComponent, {
      width: '640px',
      maxHeight: '90vh',
      panelClass: 'premium-dialog',
      data: { team: firstTeam },
    });
  }

  async joinTeam(team: Team): Promise<void> {
    const uid = this.currentUser()?.uid;
    if (!uid || this.joining()) return;
    this.joining.set(team.id);
    this.joinError.set(null);
    try {
      await this.teamService.addMember(team.id, uid, team.memberIds);
      this.joining.set(null);
      this.joinSuccess.set(team.id);
      // let the success animation play, then transition the view
      await new Promise((r) => setTimeout(r, 1200));
      this.authService.patchCurrentUser({ teamId: team.id });
    } catch {
      this.joinError.set('Failed to join the team. Please try again.');
      this.joining.set(null);
    }
  }
}
