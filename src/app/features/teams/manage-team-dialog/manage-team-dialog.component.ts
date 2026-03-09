import {
  Component,
  inject,
  signal,
  computed,
  ViewEncapsulation,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { TeamService } from '../../../core/services/team.service';
import { Team } from '../../../core/models/team.model';
import { AppUser } from '../../../core/models/user.model';

export interface ManageTeamDialogData {
  team: Team;
  companyId: string;
}

@Component({
  selector: 'app-manage-team-dialog',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatDividerModule,
  ],
  templateUrl: './manage-team-dialog.component.html',
  styleUrls: ['./manage-team-dialog.component.scss'],
})
export class ManageTeamDialogComponent {
  private teamService = inject(TeamService);
  private ref = inject(MatDialogRef<ManageTeamDialogComponent>);
  readonly data: ManageTeamDialogData = inject(MAT_DIALOG_DATA);

  team = signal<Team>({ ...this.data.team });
  members = signal<AppUser[]>([]);
  allUsers = signal<AppUser[]>([]);
  search = signal('');
  loading = signal(true);
  saving = signal<string | null>(null);

  filteredUsers = computed(() => {
    const q = this.search().toLowerCase();
    const ids = new Set(this.team().memberIds);
    return this.allUsers().filter(
      (u) =>
        !ids.has(u.uid) &&
        (u.displayName.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)),
    );
  });

  constructor() {
    this.load();
  }

  private async load(): Promise<void> {
    const [members, allUsers] = await Promise.all([
      this.teamService.getTeamMembers(this.team().id),
      this.teamService.getCompanyUsers(this.data.companyId),
    ]);
    this.members.set(members);
    this.allUsers.set(allUsers);
    this.loading.set(false);
  }

  async add(user: AppUser): Promise<void> {
    this.saving.set(user.uid);
    await this.teamService.addMember(
      this.team().id,
      user.uid,
      this.team().memberIds,
    );
    this.team.update((t) => ({ ...t, memberIds: [...t.memberIds, user.uid] }));
    this.members.update((m) => [...m, user]);
    this.saving.set(null);
  }

  async remove(user: AppUser): Promise<void> {
    this.saving.set(user.uid);
    await this.teamService.removeMember(
      this.team().id,
      user.uid,
      this.team().memberIds,
    );
    this.team.update((t) => ({
      ...t,
      memberIds: t.memberIds.filter((id) => id !== user.uid),
    }));
    this.members.update((m) => m.filter((u) => u.uid !== user.uid));
    this.saving.set(null);
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

  roleBg(role: string): string {
    return (
      (
        { admin: '#dbeafe', manager: '#ede9fe', employee: '#f0fdf4' } as Record<
          string,
          string
        >
      )[role] ?? '#f1f5f9'
    );
  }

  roleColor(role: string): string {
    return (
      (
        {
          admin: '#1d4ed8',
          manager: '#6d28d9',
          employee: '#166534',
        } as Record<string, string>
      )[role] ?? '#475569'
    );
  }

  close(): void {
    this.ref.close();
  }
}
