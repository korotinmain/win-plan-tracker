import { Component, computed, inject, signal } from '@angular/core';
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
import { Team } from '../../../core/models/team.model';

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

  get currentUser() {
    return this.authService.currentUser;
  }

  teams = signal<Team[]>([]);
  teamsLoading = signal(true);
  actingTeamId = signal<string | null>(null);
  teamError = signal<string | null>(null);

  myTeam = computed(() => {
    const tid = this.currentUser?.teamId;
    if (!tid) return null;
    return (
      this.teams().find(
        (t) => t.id === tid || t.memberIds.includes(this.currentUser!.uid),
      ) ?? null
    );
  });

  availableTeams = computed(() => {
    const uid = this.currentUser?.uid ?? '';
    return this.teams().filter((t) => !t.memberIds.includes(uid));
  });

  constructor() {
    this.teamService
      .getAllTeams()
      .pipe(takeUntilDestroyed())
      .subscribe((teams) => {
        this.teams.set(teams);
        this.teamsLoading.set(false);
      });
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
    } catch (e: any) {
      this.teamError.set(e?.message ?? 'Failed to join team.');
    } finally {
      this.actingTeamId.set(null);
    }
  }

  async leaveTeam(team: Team): Promise<void> {
    const user = this.authService.currentUser;
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
}
