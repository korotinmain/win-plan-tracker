import { Component, inject, signal } from '@angular/core';
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

  currentUser = this.authService.currentUser;
  teams = signal<Team[]>([]);
  loading = signal(true);

  constructor() {
    const companyId = this.currentUser?.companyId ?? '';
    if (companyId) {
      this.teamService.getTeamsByCompany(companyId).subscribe((teams) => {
        this.teams.set(teams);
        this.loading.set(false);
      });
    } else {
      this.loading.set(false);
    }
  }

  gradient(index: number): string {
    const [a, b] = GRADIENTS[index % GRADIENTS.length];
    return `linear-gradient(135deg, ${a}, ${b})`;
  }

  openCreateTeam(): void {
    const ref = this.dialog.open(CreateTeamDialogComponent, {
      width: '520px',
      panelClass: 'premium-dialog',
    });
    ref.afterClosed().subscribe(async (result) => {
      if (!result) return;
      await this.teamService.createTeam({
        name: result.name,
        icon: result.icon,
        companyId: this.currentUser!.companyId,
        managerId: this.currentUser!.uid,
        memberIds: [],
        createdAt: new Date(),
      });
    });
  }

  openManageTeam(team: Team): void {
    this.dialog.open(ManageTeamDialogComponent, {
      width: '640px',
      maxHeight: '90vh',
      panelClass: 'premium-dialog',
      data: { team, companyId: this.currentUser!.companyId },
    });
  }
}
