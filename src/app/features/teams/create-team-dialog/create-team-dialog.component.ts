import { Component, signal, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatRippleModule } from '@angular/material/core';

export const TEAM_ICONS = [
  'groups',
  'diversity_3',
  'hub',
  'psychology',
  'rocket_launch',
  'bolt',
  'auto_awesome',
  'local_fire_department',
  'code',
  'terminal',
  'engineering',
  'design_services',
  'analytics',
  'insights',
  'campaign',
  'security',
  'school',
  'emoji_objects',
  'brush',
  'sports_esports',
  'business_center',
  'star',
  'favorite',
  'diamond',
];

@Component({
  selector: 'app-create-team-dialog',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatRippleModule,
  ],
  templateUrl: './create-team-dialog.component.html',
  styleUrls: ['./create-team-dialog.component.scss'],
})
export class CreateTeamDialogComponent {
  name = '';
  selectedIcon = signal('groups');
  readonly icons = TEAM_ICONS;

  constructor(private dialogRef: MatDialogRef<CreateTeamDialogComponent>) {}

  select(icon: string): void {
    this.selectedIcon.set(icon);
  }

  submit(): void {
    if (!this.name.trim()) return;
    this.dialogRef.close({ name: this.name.trim(), icon: this.selectedIcon() });
  }

  dismiss(): void {
    this.dialogRef.close(null);
  }
}
