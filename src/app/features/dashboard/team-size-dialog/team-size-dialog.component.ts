import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { format } from 'date-fns';
import { AppUser } from '../../../core/models/user.model';

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

  roleLabel(role: string): string {
    const map: Record<string, string> = {
      admin: 'Admin',
      manager: 'Manager',
      employee: 'Member',
    };
    return map[role] ?? role;
  }

  roleColor(role: string): string {
    const map: Record<string, string> = {
      admin: '#f59e0b',
      manager: '#6366f1',
      employee: '#10b981',
    };
    return map[role] ?? '#64748b';
  }

  roleBg(role: string): string {
    const map: Record<string, string> = {
      admin: 'rgba(245,158,11,0.15)',
      manager: 'rgba(99,102,241,0.15)',
      employee: 'rgba(16,185,129,0.15)',
    };
    return map[role] ?? 'rgba(100,116,139,0.15)';
  }

  getInitials(name: string): string {
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
    const palette = [
      '#6366f1',
      '#8b5cf6',
      '#ec4899',
      '#f59e0b',
      '#10b981',
      '#06b6d4',
      '#ef4444',
    ];
    const hash = uid.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return palette[hash % palette.length];
  }

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
