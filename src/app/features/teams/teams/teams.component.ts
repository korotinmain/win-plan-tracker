import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../../core/services/auth.service';
import { TeamService } from '../../../core/services/team.service';
import { Team } from '../../../core/models/team.model';
import { CreateTeamDialogComponent } from '../create-team-dialog/create-team-dialog.component';
import { ManageTeamDialogComponent } from '../manage-team-dialog/manage-team-dialog.component';

const GRADIENTS = [
  ['#6366f1', '#8b5cf6'],
  ['#f59e0b', '#f97316'],
  ['#10b981', '#059669'],
  ['#ef4444', '#f43f5e'],
  ['#3b82f6', '#60a5fa'],
  ['#8b5cf6', '#ec4899'],
  ['#06b6d4', '#3b82f6'],
  ['#84cc16', '#10b981'],
];

@Component({
  selector: 'app-teams',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
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
  private dialog = inject(MatDialog);
  private destroyRef = inject(DestroyRef);

  get currentUser() {
    return this.authService.currentUser;
  }

  teams = signal<Team[]>([]);
  loading = signal(true);
  creating = signal(false);
  createError = signal<string | null>(null);

  usedIcons = computed(() => new Set(this.teams().map((t) => t.icon)));

  isAdminOrManager(): boolean {
    const role = this.currentUser?.role;
    return role === 'admin' || role === 'manager';
  }

  constructor() {
    this.teamService
      .getAllTeams()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (teams) => {
          this.teams.set(teams);
          this.loading.set(false);
        },
        error: (err) => {
          console.error('Failed to load teams:', err);
          this.loading.set(false);
        },
      });
  }

  gradient(index: number): string {
    const [a, b] = GRADIENTS[index % GRADIENTS.length];
    return `linear-gradient(135deg, ${a}, ${b})`;
  }

  isMemberOf(team: Team): boolean {
    return team.memberIds.includes(this.currentUser?.uid ?? '');
  }

  isManagerOf(team: Team): boolean {
    return team.managerId === (this.currentUser?.uid ?? '');
  }

  openCreateTeam(): void {
    const ref = this.dialog.open(CreateTeamDialogComponent, {
      width: '540px',
      panelClass: 'premium-dialog',
      data: { usedIcons: this.usedIcons() },
    });
    ref.afterClosed().subscribe(async (result) => {
      if (!result) return;
      this.creating.set(true);
      this.createError.set(null);
      try {
        const user = this.authService.currentUser;
        if (!user) throw new Error('Not authenticated');
        await this.teamService.createTeam({
          name: result.name,
          icon: result.icon,
          managerId: user.uid,
          memberIds: [],
          createdAt: new Date(),
        });
      } catch (e: any) {
        this.createError.set(
          e?.message ?? 'Failed to create team. Check Firestore permissions.',
        );
        console.error('Team creation failed:', e);
      } finally {
        this.creating.set(false);
      }
    });
  }

  openManageTeam(team: Team, event: Event): void {
    if (!this.isManagerOf(team)) return;
    event.stopPropagation();
    this.dialog.open(ManageTeamDialogComponent, {
      width: '640px',
      maxHeight: '90vh',
      panelClass: 'premium-dialog',
      data: { team },
    });
  }
}
