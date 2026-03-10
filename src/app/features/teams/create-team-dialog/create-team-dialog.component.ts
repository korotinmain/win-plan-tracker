import {
  Component,
  computed,
  inject,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogRef,
  MatDialogModule,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatRippleModule } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';

export const TEAM_ICONS = [
  // Teams & People
  'groups',
  'diversity_3',
  'people',
  'people_alt',
  'supervisor_account',
  'manage_accounts',
  'badge',
  'group_work',
  'person',
  'group',
  'handshake',
  'face',
  // Engineering & Dev
  'code',
  'terminal',
  'computer',
  'devices',
  'memory',
  'developer_mode',
  'dns',
  'integration_instructions',
  'bug_report',
  'build',
  'usb',
  'account_tree',
  // Design
  'design_services',
  'brush',
  'palette',
  'draw',
  'format_paint',
  'auto_awesome',
  'photo_camera',
  'color_lens',
  'style',
  'create',
  // Business
  'business_center',
  'work',
  'cases',
  'assignment',
  'done_all',
  'fact_check',
  'analytics',
  'insights',
  'bar_chart',
  'trending_up',
  'poll',
  'payments',
  'attach_money',
  'monetization_on',
  'sell',
  // Marketing & Comms
  'campaign',
  'touch_app',
  'star',
  'favorite',
  'thumb_up',
  'emoji_objects',
  'lightbulb',
  'chat',
  'forum',
  'send',
  // Cloud & Infra
  'cloud',
  'storage',
  'cloud_upload',
  'cloud_done',
  'hub',
  'security',
  'shield',
  'lock',
  'vpn_lock',
  'router',
  // R&D & Science
  'science',
  'biotech',
  'psychology',
  'school',
  'book',
  'calculate',
  // Performance & Awards
  'rocket_launch',
  'bolt',
  'local_fire_department',
  'speed',
  'diamond',
  'emoji_events',
  'military_tech',
  'grade',
  'sports_esports',
  'fitness_center',
  'verified',
  // Support & Ops
  'support_agent',
  'headset_mic',
  'help',
  'engineering',
  'construction',
  'architecture',
  'public',
  'language',
  'explore',
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
    MatTooltipModule,
  ],
  templateUrl: './create-team-dialog.component.html',
  styleUrls: ['./create-team-dialog.component.scss'],
})
export class CreateTeamDialogComponent {
  private dialogRef = inject(MatDialogRef<CreateTeamDialogComponent>);
  private data = inject(MAT_DIALOG_DATA, { optional: true }) as {
    usedIcons?: Set<string>;
  } | null;
  private readonly _usedIcons = new Set<string>(this.data?.usedIcons ?? []);

  name = '';
  selectedIcon = signal(
    TEAM_ICONS.find((i) => !this._usedIcons.has(i)) ?? 'groups',
  );
  iconSearch = signal('');
  readonly icons = TEAM_ICONS;

  filteredIcons = computed(() => {
    const q = this.iconSearch().toLowerCase().replace(/\s+/g, '_');
    if (!q) return this.icons;
    return this.icons.filter((icon) => icon.includes(q));
  });

  isIconTaken(icon: string): boolean {
    return this._usedIcons.has(icon);
  }

  select(icon: string): void {
    if (this.isIconTaken(icon)) return;
    this.selectedIcon.set(icon);
  }

  submit(): void {
    if (!this.name.trim() || this.isIconTaken(this.selectedIcon())) return;
    this.dialogRef.close({ name: this.name.trim(), icon: this.selectedIcon() });
  }

  dismiss(): void {
    this.dialogRef.close(null);
  }

  iconLabel(icon: string): string {
    return icon.replace(/_/g, ' ');
  }
}
