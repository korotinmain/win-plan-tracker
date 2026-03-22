import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { distinctUntilChanged, map, switchMap } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import {
  TeamDirectoryService,
  filterJoinableTeams,
} from '../../../core/services/team-directory.service';
import { TeamService } from '../../../core/services/team.service';
import { ThemeService } from '../../../core/services/theme.service';
import { getErrorMessage } from '../../../shared/utils/error.util';
import {
  Team,
  SprintCeremonyConfig,
  DEFAULT_CEREMONY_CONFIG,
} from '../../../core/models/team.model';
import { AppUser } from '../../../core/models/user.model';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTooltipModule,
  ],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
})
export class SettingsComponent {
  private authService = inject(AuthService);
  private teamDirectoryService = inject(TeamDirectoryService);
  private teamService = inject(TeamService);
  private snackBar = inject(MatSnackBar);
  private destroyRef = inject(DestroyRef);
  themeService = inject(ThemeService);

  currentUser = signal<AppUser | null>(this.authService.currentUser);

  teams = signal<Team[]>([]);
  currentTeam = signal<Team | null>(null);
  teamsLoading = signal(true);
  actingTeamId = signal<string | null>(null);
  teamError = signal<string | null>(null);
  ceremonyConfig = signal<SprintCeremonyConfig>({ ...DEFAULT_CEREMONY_CONFIG });
  savingCeremony = signal(false);

  initials = computed(() => {
    return (
      (this.currentUser()?.displayName ?? '')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((n: string) => n[0])
        .join('')
        .toUpperCase() || '?'
    );
  });

  myTeam = computed(() => {
    return this.currentTeam();
  });

  isTeamAdmin = computed(() => {
    const user = this.currentUser();
    const team = this.myTeam();
    if (!team || !user) return false;
    return (
      team.managerId === user.uid ||
      user.role === 'admin' ||
      user.role === 'manager'
    );
  });

  availableTeams = computed(() => {
    return filterJoinableTeams(this.teams(), this.currentUser()?.uid ?? '');
  });

  constructor() {
    this.authService.currentUser$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((u) => this.currentUser.set(u));

    this.authService.currentUser$
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        map((user) => user?.teamId ?? null),
        distinctUntilChanged(),
        switchMap((teamId) => {
          this.teamsLoading.set(true);
          if (!teamId) {
            this.currentTeam.set(null);
            this.ceremonyConfig.set({ ...DEFAULT_CEREMONY_CONFIG });
            return this.teamDirectoryService
              .getDirectoryTeams()
              .pipe(map((teams) => ({ kind: 'directory' as const, teams })));
          }

          return this.teamService.watchTeam(teamId).pipe(
            map((team) => ({ kind: 'team' as const, team })),
          );
        }),
      )
      .subscribe((result) => {
        if (result.kind === 'directory') {
          this.teams.set(result.teams);
          this.currentTeam.set(null);
        } else {
          this.currentTeam.set(result.team);
          this.teams.set([]);
          if (result.team) {
            this.ceremonyConfig.set({
              ...DEFAULT_CEREMONY_CONFIG,
              ...(result.team.ceremonyConfig ?? {}),
            });
          } else {
            this.ceremonyConfig.set({ ...DEFAULT_CEREMONY_CONFIG });
          }
        }
        this.teamsLoading.set(false);
      });
  }

  async joinTeam(team: Team): Promise<void> {
    const user = this.currentUser();
    if (!user) return;
    this.actingTeamId.set(team.id);
    this.teamError.set(null);
    try {
      await this.teamService.joinTeam(team.id, user.uid, team.memberIds);
      this.authService.patchCurrentUser({ teamId: team.id });
      this.snackBar.open(`Joined "${team.name}"`, 'OK', { duration: 3000 });
    } catch (e: unknown) {
      this.teamError.set(getErrorMessage(e, 'Failed to join team.'));
    } finally {
      this.actingTeamId.set(null);
    }
  }

  async leaveTeam(team: Team): Promise<void> {
    const user = this.currentUser();
    if (!user) return;
    this.actingTeamId.set(team.id);
    this.teamError.set(null);
    try {
      await this.teamService.removeMember(team.id, user.uid, team.memberIds);
      this.authService.patchCurrentUser({ teamId: '' });
      this.snackBar.open(`Left "${team.name}"`, 'OK', { duration: 3000 });
    } catch (e: unknown) {
      this.teamError.set(getErrorMessage(e, 'Failed to leave team.'));
    } finally {
      this.actingTeamId.set(null);
    }
  }

  patchCeremony(_patch: Partial<SprintCeremonyConfig>): void {}

  updateSprintLength(weeks: number): void {
    this.ceremonyConfig.set({
      ...this.ceremonyConfig(),
      sprintLengthWeeks: weeks,
    });
  }

  async saveCeremonyConfig(): Promise<void> {
    const team = this.myTeam();
    if (!team) return;
    this.savingCeremony.set(true);
    try {
      await this.teamService.updateCeremonyConfig(
        team.id,
        this.ceremonyConfig(),
      );
      this.snackBar.open('Sprint ceremony settings saved', 'OK', {
        duration: 3000,
      });
    } catch (e: unknown) {
      this.snackBar.open(getErrorMessage(e, 'Failed to save.'), 'OK', {
        duration: 4000,
      });
    } finally {
      this.savingCeremony.set(false);
    }
  }
}
