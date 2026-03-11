import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { switchMap, combineLatest, of, map, distinctUntilChanged } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { TeamService } from '../../../core/services/team.service';
import { CalendarService } from '../../../core/services/calendar.service';
import { PresenceService } from '../../../core/services/presence.service';
import { Team } from '../../../core/models/team.model';
import { AppUser } from '../../../core/models/user.model';
import { CalendarEvent } from '../../../core/models/event.model';
import { TeamMember } from '../../../core/models/team-member.model';
import {
  AddMemberDialogComponent,
  AddMemberDialogData,
} from '../add-member-dialog/add-member-dialog.component';
import {
  EditMemberDialogComponent,
  EditMemberDialogData,
  RichMember,
} from '../edit-member-dialog/edit-member-dialog.component';
import { ManageTeamDialogComponent } from '../manage-team-dialog/manage-team-dialog.component';
import { CreateTeamDialogComponent } from '../create-team-dialog/create-team-dialog.component';

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
    MatMenuModule,
    MatTooltipModule,
    MatSnackBarModule,
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
  private snackBar = inject(MatSnackBar);
  private destroyRef = inject(DestroyRef);

  // ── State ──────────────────────────────────────────────────────────────────
  currentUser = signal<AppUser | null>(this.authService.currentUser);
  currentTeam = signal<Team | null>(null);
  rawUsers = signal<AppUser[]>([]);
  enrichments = signal<Map<string, TeamMember>>(new Map());
  events = signal<CalendarEvent[]>([]);
  onlineUids = signal<Set<string>>(new Set());
  teams = signal<Team[]>([]); // all teams for join-team flow
  loading = signal(true);

  // ── Filters ───────────────────────────────────────────────────────────────
  searchQuery = signal('');
  selectedRole = signal('');
  selectedStatus = signal('');
  sortBy = signal('name');

  // ── Join-team state ───────────────────────────────────────────────────────
  joining = signal<string | null>(null);
  joinError = signal<string | null>(null);
  joinSuccess = signal<string | null>(null);
  joinSearchQuery = signal('');

  readonly roleOptions = [
    { value: '', label: 'All Roles' },
    { value: 'owner', label: 'Owner' },
    { value: 'admin', label: 'Admin' },
    { value: 'manager', label: 'Manager' },
    { value: 'member', label: 'Member' },
    { value: 'employee', label: 'Employee' },
  ];

  readonly statusOptions = [
    { value: '', label: 'All Status' },
    { value: 'online', label: 'Online' },
    { value: 'offline', label: 'Offline' },
  ];

  readonly sortOptions = [
    { value: 'name', label: 'Name A–Z' },
    { value: 'online', label: 'Online First' },
    { value: 'events', label: 'Most Events' },
    { value: 'sprints', label: 'Most Sprints' },
    { value: 'capacity', label: 'Capacity' },
  ];

  // ── Derived ───────────────────────────────────────────────────────────────
  hasTeam = computed(() => !!this.currentUser()?.teamId);

  members = computed<RichMember[]>(() => {
    const users = this.rawUsers();
    const enrichMap = this.enrichments();
    const online = this.onlineUids();
    const evts = this.events();
    return users.map((u) => {
      const enrich = enrichMap.get(u.uid);
      return {
        uid: u.uid,
        displayName: u.displayName,
        email: u.email,
        photoURL: u.photoURL,
        appRole: u.role,
        teamRole: enrich?.role ?? null,
        capacityPoints: enrich?.capacityPoints ?? 8,
        timezone: enrich?.timezone ?? 'UTC',
        isActive: enrich?.isActive ?? true,
        onlineState: online.has(u.uid)
          ? ('online' as const)
          : ('offline' as const),
        eventCount: evts.filter((e) => e.userId === u.uid).length,
        sprintCount: evts.filter(
          (e) =>
            e.userId === u.uid &&
            (e.type === 'planning' || e.type === 'sprint-review'),
        ).length,
      };
    });
  });

  filteredMembers = computed<RichMember[]>(() => {
    let list = this.members();
    const q = this.searchQuery().toLowerCase();
    const role = this.selectedRole();
    const status = this.selectedStatus();
    const sort = this.sortBy();

    if (q) {
      list = list.filter(
        (m) =>
          m.displayName.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q) ||
          (m.teamRole ?? m.appRole).toLowerCase().includes(q),
      );
    }
    if (role) {
      list = list.filter(
        (m) => (m.teamRole ?? m.appRole) === role || m.appRole === role,
      );
    }
    if (status === 'online')
      list = list.filter((m) => m.onlineState === 'online');
    else if (status === 'offline')
      list = list.filter((m) => m.onlineState !== 'online');

    list = [...list];
    if (sort === 'name')
      list.sort((a, b) => a.displayName.localeCompare(b.displayName));
    else if (sort === 'online')
      list.sort(
        (a, b) =>
          (b.onlineState === 'online' ? 1 : 0) -
          (a.onlineState === 'online' ? 1 : 0),
      );
    else if (sort === 'events')
      list.sort((a, b) => b.eventCount - a.eventCount);
    else if (sort === 'sprints')
      list.sort((a, b) => b.sprintCount - a.sprintCount);
    else if (sort === 'capacity')
      list.sort((a, b) => b.capacityPoints - a.capacityPoints);

    return list;
  });

  onlineCount = computed(
    () => this.members().filter((m) => m.onlineState === 'online').length,
  );
  totalEvents = computed(() => this.events().length);
  totalSprints = computed(
    () =>
      this.events().filter(
        (e) => e.type === 'planning' || e.type === 'sprint-review',
      ).length,
  );
  filteredJoinTeams = computed(() => {
    const q = this.joinSearchQuery().toLowerCase().trim();
    if (!q) return this.teams();
    return this.teams().filter((t) => t.name.toLowerCase().includes(q));
  });
  hasActiveFilters = computed(
    () =>
      !!this.searchQuery() ||
      !!this.selectedRole() ||
      !!this.selectedStatus() ||
      this.sortBy() !== 'name',
  );

  // ── Init ──────────────────────────────────────────────────────────────────
  private _prevMemberKey = '';

  constructor() {
    this.authService.currentUser$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((u) => this.currentUser.set(u));

    this.presenceService.onlineUids$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((uids) => this.onlineUids.set(uids));

    this.teamService
      .getAllTeams()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((t) => this.teams.set(t));

    // Main data: react when the user's teamId changes
    this.authService.currentUser$
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        map((u) => u?.teamId ?? null),
        distinctUntilChanged(),
        switchMap((teamId) => {
          if (!teamId) {
            this.loading.set(false);
            return of(null);
          }
          const uid = this.authService.currentUser?.uid ?? '';
          return combineLatest([
            this.teamService
              .getTeamsForUser(uid)
              .pipe(map((ts) => ts.find((t) => t.id === teamId) ?? null)),
            this.teamService.getTeamMembersEnrichments(teamId),
            this.calendarService.getTeamAllEvents(teamId),
          ]).pipe(
            map(([team, enrichments, events]) => ({
              team,
              enrichments,
              events,
            })),
          );
        }),
      )
      .subscribe(async (data) => {
        if (!data) {
          this.loading.set(false);
          return;
        }
        const { team, enrichments, events } = data;
        this.currentTeam.set(team);
        this.enrichments.set(new Map(enrichments.map((e) => [e.id, e])));
        this.events.set(events);
        if (team) {
          const key = [...team.memberIds].sort().join(',');
          if (key !== this._prevMemberKey) {
            this._prevMemberKey = key;
            const allUsers = await this.teamService.getAllUsers();
            this.rawUsers.set(
              allUsers.filter((u) => team.memberIds.includes(u.uid)),
            );
          }
        }
        this.loading.set(false);
      });
  }

  // ── Actions ───────────────────────────────────────────────────────────────
  isAdminOrManager(): boolean {
    const role = this.currentUser()?.role;
    return role === 'admin' || role === 'manager';
  }

  clearFilters(): void {
    this.searchQuery.set('');
    this.selectedRole.set('');
    this.selectedStatus.set('');
    this.sortBy.set('name');
  }

  openAddMember(): void {
    const team = this.currentTeam();
    if (!team) return;
    this.dialog
      .open(AddMemberDialogComponent, {
        width: '560px',
        maxHeight: '90vh',
        panelClass: 'team-member-dialog',
        data: {
          teamId: team.id,
          team,
          currentMemberIds: team.memberIds,
        } as AddMemberDialogData,
      })
      .afterClosed()
      .subscribe((result) => {
        if (result?.confirmed) {
          this.snackBar.open('Member added successfully', 'Dismiss', {
            duration: 3000,
          });
        }
      });
  }

  openEditMember(member: RichMember, event?: MouseEvent): void {
    event?.stopPropagation();
    const team = this.currentTeam();
    if (!team) return;
    this.dialog
      .open(EditMemberDialogComponent, {
        width: '500px',
        maxHeight: '90vh',
        panelClass: 'team-member-dialog',
        data: { teamId: team.id, team, member } as EditMemberDialogData,
      })
      .afterClosed()
      .subscribe((result) => {
        if (result?.confirmed) {
          const msg = result.removed
            ? `${member.displayName} removed from team`
            : 'Member updated';
          this.snackBar.open(msg, 'Dismiss', { duration: 3500 });
        }
      });
  }

  openManageTeam(): void {
    const team = this.currentTeam();
    if (!team) return;
    this.dialog.open(ManageTeamDialogComponent, {
      width: '640px',
      maxHeight: '90vh',
      panelClass: 'premium-dialog',
      data: { team },
    });
  }

  openCreateTeam(): void {
    this.dialog.open(CreateTeamDialogComponent, {
      width: '560px',
      maxHeight: '90vh',
      panelClass: 'premium-dialog',
    });
  }

  effectiveRole(member: RichMember): string {
    return member.teamRole ?? member.appRole;
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
      await new Promise((r) => setTimeout(r, 1200));
      this.authService.patchCurrentUser({ teamId: team.id });
    } catch {
      this.joinError.set('Failed to join the team. Please try again.');
      this.joining.set(null);
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
    for (let i = 0; i < uid.length; i++) {
      hash = uid.charCodeAt(i) + ((hash << 5) - hash);
    }
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  }

  tzShort(timezone: string): string {
    if (!timezone || timezone === 'UTC') return 'UTC';
    try {
      return (
        new Intl.DateTimeFormat('en', {
          timeZone: timezone,
          timeZoneName: 'short',
        })
          .formatToParts(new Date())
          .find((p) => p.type === 'timeZoneName')?.value ?? timezone
      );
    } catch {
      return timezone;
    }
  }
}
