import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../../core/services/auth.service';
import { TeamService } from '../../../core/services/team.service';
import { ThemeService } from '../../../core/services/theme.service';
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
  private teamService = inject(TeamService);
  private snackBar = inject(MatSnackBar);
  private destroyRef = inject(DestroyRef);
  themeService = inject(ThemeService);

  currentUser = signal<AppUser | null>(this.authService.currentUser);

  teams = signal<Team[]>([]);
  teamsLoading = signal(true);
  actingTeamId = signal<string | null>(null);
  teamError = signal<string | null>(null);
  ceremonyConfig = signal<SprintCeremonyConfig>({ ...DEFAULT_CEREMONY_CONFIG });
  savingCeremony = signal(false);

  readonly dowOptions = [
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
  ];

  get weekOptions(): { value: number; label: string }[] {
    return Array.from(
      { length: this.ceremonyConfig().sprintLengthWeeks },
      (_, i) => ({ value: i + 1, label: `Week ${i + 1}` }),
    );
  }

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
    const tid = this.currentUser()?.teamId;
    if (!tid) return null;
    return (
      this.teams().find(
        (t) => t.id === tid || t.memberIds.includes(this.currentUser()!.uid),
      ) ?? null
    );
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
    const uid = this.currentUser()?.uid ?? '';
    return this.teams().filter((t) => !t.memberIds.includes(uid));
  });

  constructor() {
    this.authService.currentUser$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((u) => this.currentUser.set(u));

    this.teamService
      .getAllTeams()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((teams) => {
        this.teams.set(teams);
        this.teamsLoading.set(false);
        const tid = this.currentUser()?.teamId;
        const team = tid ? teams.find((t) => t.id === tid) : null;
        if (team) {
          this.ceremonyConfig.set({
            ...DEFAULT_CEREMONY_CONFIG,
            ...(team.ceremonyConfig ?? {}),
          });
        }
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
    } catch (e: any) {
      this.teamError.set(e?.message ?? 'Failed to join team.');
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
    } catch (e: any) {
      this.teamError.set(e?.message ?? 'Failed to leave team.');
    } finally {
      this.actingTeamId.set(null);
    }
  }

  patchCeremony(patch: Partial<SprintCeremonyConfig>): void {
    this.ceremonyConfig.set({ ...this.ceremonyConfig(), ...patch });
  }

  updateSprintLength(weeks: number): void {
    const cfg = this.ceremonyConfig();
    const clamp = (v: number) => Math.min(v, weeks);
    this.ceremonyConfig.set({
      ...cfg,
      sprintLengthWeeks: weeks,
      planningWeek: clamp(cfg.planningWeek),
      refinementWeek: clamp(cfg.refinementWeek),
      sprintReviewWeek: clamp(cfg.sprintReviewWeek),
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
    } catch (e: any) {
      this.snackBar.open(e?.message ?? 'Failed to save.', 'OK', {
        duration: 4000,
      });
    } finally {
      this.savingCeremony.set(false);
    }
  }
}
