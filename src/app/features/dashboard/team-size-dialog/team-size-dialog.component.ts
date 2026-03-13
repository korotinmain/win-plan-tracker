import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { format } from 'date-fns';
import { AppUser } from '../../../core/models/user.model';
import { getInitials } from '../../../shared/utils/initials.util';
import { getAvatarColor } from '../../../shared/utils/avatar.util';
import {
  getRoleLabel,
  getRoleColor,
  getRoleBg,
} from '../../../shared/utils/role.util';

export interface TeamSizeDialogData {
  members: AppUser[];
  working: number;
  onVacation: number;
  asOf: Date;
}

@Component({
  selector: 'app-team-size-dialog',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './team-size-dialog.component.html',
  styleUrls: ['./team-size-dialog.component.scss'],
})
export class TeamSizeDialogComponent {
  private dialogRef = inject(MatDialogRef<TeamSizeDialogComponent>);
  readonly data: TeamSizeDialogData = inject(MAT_DIALOG_DATA);

  get total(): number {
    return this.data.members.length;
  }

  get asOfFormatted(): string {
    return format(this.data.asOf, 'MMM d, h:mm aa');
  }

  get workingPct(): number {
    return this.total ? Math.round((this.data.working / this.total) * 100) : 0;
  }

  get vacationPct(): number {
    return this.total
      ? Math.round((this.data.onVacation / this.total) * 100)
      : 0;
  }

  protected readonly getInitials = getInitials;
  protected readonly avatarColor = getAvatarColor;
  protected readonly roleLabel = getRoleLabel;
  protected readonly roleColor = getRoleColor;
  protected readonly roleBg = getRoleBg;

  membersByRole = (): { role: string; members: AppUser[] }[] => {
    const order = ['admin', 'manager', 'employee'];
    const groups = new Map<string, AppUser[]>();
    this.data.members.forEach((m) => {
      if (!groups.has(m.role)) groups.set(m.role, []);
      groups.get(m.role)!.push(m);
    });
    return order
      .filter((r) => groups.has(r))
      .map((r) => ({ role: r, members: groups.get(r)! }));
  };

  close(): void {
    this.dialogRef.close();
  }
}
