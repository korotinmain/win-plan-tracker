import { Component, ViewEncapsulation, inject, signal } from '@angular/core';
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
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { TeamService } from '../../../core/services/team.service';
import { Team } from '../../../core/models/team.model';
import {
  MemberRole,
  MEMBER_ROLES,
  TIMEZONES,
} from '../../../core/models/team-member.model';

export interface RichMember {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  appRole: string;
  teamRole: MemberRole | null;
  capacityPoints: number;
  timezone: string;
  isActive: boolean;
  onlineState: 'online' | 'away' | 'offline';
  eventCount: number;
  sprintCount: number;
}

export interface EditMemberDialogData {
  teamId: string;
  team: Team;
  member: RichMember;
}

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
  selector: 'app-edit-member-dialog',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatFormFieldModule,
  ],
  templateUrl: './edit-member-dialog.component.html',
  styleUrls: ['./edit-member-dialog.component.scss'],
})
export class EditMemberDialogComponent {
  private teamService = inject(TeamService);
  private ref = inject(MatDialogRef<EditMemberDialogComponent>);
  readonly data: EditMemberDialogData = inject(MAT_DIALOG_DATA);

  readonly memberRoles = MEMBER_ROLES;
  readonly timezones = TIMEZONES;

  saving = signal(false);
  removing = signal(false);
  confirmRemove = signal(false);
  error = signal<string | null>(null);

  role = signal<MemberRole>(this.data.member.teamRole ?? 'member');
  capacityPoints = signal(this.data.member.capacityPoints);
  timezone = signal(this.data.member.timezone || 'UTC');
  isActive = signal(this.data.member.isActive);

  decreaseCapacity(): void {
    this.capacityPoints.update((v) => Math.max(1, v - 1));
  }

  increaseCapacity(): void {
    this.capacityPoints.update((v) => Math.min(50, v + 1));
  }

  async save(): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.teamService.updateTeamMemberEnrichment(
        this.data.teamId,
        this.data.member.uid,
        {
          role: this.role(),
          capacityPoints: this.capacityPoints(),
          timezone: this.timezone(),
          isActive: this.isActive(),
        },
      );
      this.ref.close({ confirmed: true });
    } catch (e: any) {
      this.error.set(e?.message ?? 'Failed to save changes.');
    } finally {
      this.saving.set(false);
    }
  }

  async removeMember(): Promise<void> {
    if (this.removing()) return;
    this.removing.set(true);
    this.error.set(null);
    try {
      await this.teamService.removeTeamMember(
        this.data.teamId,
        this.data.member.uid,
        this.data.team.memberIds,
      );
      this.ref.close({ confirmed: true, removed: true });
    } catch (e: any) {
      this.error.set(e?.message ?? 'Failed to remove member.');
      this.confirmRemove.set(false);
    } finally {
      this.removing.set(false);
    }
  }

  close(): void {
    this.ref.close(false);
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
}
