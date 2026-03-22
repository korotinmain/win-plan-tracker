import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  DropdownMenuComponent,
  MenuItemComponent,
  MenuDividerComponent,
} from '../../../shared/components/dropdown-menu/dropdown-menu.component';
import {
  EMPTY,
  switchMap,
  combineLatest,
  of,
  map,
  distinctUntilChanged,
  tap,
} from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import {
  TeamDirectoryService,
  filterJoinableTeams,
} from '../../../core/services/team-directory.service';
import { TeamService } from '../../../core/services/team.service';
import { SprintService } from '../../../core/services/sprint.service';
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
import { CreateTeamDialogComponent } from '../create-team-dialog/create-team-dialog.component';
import { getInitials } from '../../../shared/utils/initials.util';
import { getAvatarColor } from '../../../shared/utils/avatar.util';

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
    MatSelectModule,
    MatFormFieldModule,
    DropdownMenuComponent,
    MenuItemComponent,
    MenuDividerComponent,
  ],
  templateUrl: './teams.component.html',
  styleUrls: ['./teams.component.scss'],
})
export class TeamsComponent {
  private authService = inject(AuthService);
  private teamDirectoryService = inject(TeamDirectoryService);
  private teamService = inject(TeamService);
  private sprintService = inject(SprintService);
  private readonly _sprintInfo = this.sprintService.getSprintInfo();
  private calendarService = inject(CalendarService);
  private presenceService = inject(PresenceService);
  private dialog = inject(MatDialog);
  private router = inject(Router);
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
        sprintCount: evts.filter((e) => {
          if (e.userId !== u.uid) return false;
          const d = new Date(e.date);
          return d >= this._sprintInfo.startRaw && d <= this._sprintInfo.endRaw;
        }).length,
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
  totalSprints = computed(() =>
    this.members().reduce((sum, m) => sum + m.sprintCount, 0),
  );
  canLeaveTeam = computed(() => {
    const user = this.currentUser();
    const team = this.currentTeam();
    return !!user?.teamId && !!team && team.managerId !== user.uid;
  });
  filteredJoinTeams = computed(() => {
    return filterJoinableTeams(
      this.teams(),
      this.currentUser()?.uid ?? '',
      this.joinSearchQuery(),
    );
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

    this.authService.currentUser$
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        map((u) => u?.teamId ?? null),
        distinctUntilChanged(),
        switchMap((teamId) => {
          if (teamId) {
            this.teams.set([]);
            return EMPTY;
          }
          this.loading.set(true);
          return this.teamDirectoryService.getDirectoryTeams().pipe(
            tap((teams) => {
              this.teams.set(teams);
              this.loading.set(false);
            }),
          );
        }),
      )
      .subscribe();

    // Main data: react when the user's teamId changes
    this.authService.currentUser$
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        map((u) => u?.teamId ?? null),
        distinctUntilChanged(),
        switchMap((teamId) => {
          if (!teamId) {
            this.loading.set(true);
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
            const members = await this.teamService.getMembersByIds(
              team.memberIds,
            );
            this.rawUsers.set(members);
          }
        }
        this.loading.set(false);
      });
  }

  // ── Actions ───────────────────────────────────────────────────────────────
  isAdminOrManager(): boolean {
    const appRole = this.currentUser()?.role;
    if (appRole === 'admin' || appRole === 'manager') return true;
    const uid = this.currentUser()?.uid;
    if (!uid) return false;
    const teamRole = this.enrichments().get(uid)?.role;
    return (
      teamRole === 'owner' || teamRole === 'admin' || teamRole === 'manager'
    );
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
    this.router.navigate(['/teams', team.id, 'settings']);
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
      await this.teamService.joinTeam(team.id, uid, team.memberIds);
      this.joining.set(null);
      this.joinSuccess.set(team.id);
      await new Promise((r) => setTimeout(r, 1200));
      this.authService.patchCurrentUser({ teamId: team.id });
    } catch (err: any) {
      this.joinError.set(
        err?.message ?? 'Failed to join the team. Please try again.',
      );
      this.joining.set(null);
    }
  }

  confirmRemoveMember(member: RichMember, event?: MouseEvent): void {
    event?.stopPropagation();
    const team = this.currentTeam();
    if (!team) return;
    const snackRef = this.snackBar.open(
      `Remove ${member.displayName} from the team?`,
      'Remove',
      { duration: 6000 },
    );
    snackRef.onAction().subscribe(async () => {
      try {
        await this.teamService.removeTeamMember(
          team.id,
          member.uid,
          team.memberIds,
        );
        this.snackBar.open(
          `${member.displayName} removed from team`,
          'Dismiss',
          { duration: 3000 },
        );
      } catch {
        this.snackBar.open('Failed to remove member', 'Dismiss', {
          duration: 3000,
        });
      }
    });
  }

  leaveTeam(): void {
    const user = this.currentUser();
    const team = this.currentTeam();
    if (!user || !team) return;
    const snackRef = this.snackBar.open(
      `Leave "${team.name}"? You will need to be re-invited to rejoin.`,
      'Leave',
      { duration: 7000 },
    );
    snackRef.onAction().subscribe(async () => {
      try {
        await this.teamService.leaveTeam(team.id, user.uid);
        this.authService.patchCurrentUser({ teamId: '' });
        this.snackBar.open('You have left the team', 'Dismiss', {
          duration: 3000,
        });
      } catch {
        this.snackBar.open('Failed to leave the team', 'Dismiss', {
          duration: 3000,
        });
      }
    });
  }

  protected readonly initials = getInitials;
  protected readonly avatarColor = getAvatarColor;

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
