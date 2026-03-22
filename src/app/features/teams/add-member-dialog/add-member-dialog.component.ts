import {
  Component,
  OnInit,
  ViewEncapsulation,
  computed,
  inject,
  signal,
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
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { TeamService } from '../../../core/services/team.service';
import {
  TeamDirectoryService,
  filterCandidateUsers,
} from '../../../core/services/team-directory.service';
import { getErrorMessage } from '../../../shared/utils/error.util';
import { Team } from '../../../core/models/team.model';
import { AppUser } from '../../../core/models/user.model';
import {
  MemberRole,
  MEMBER_ROLES,
  TIMEZONES,
  TeamMember,
} from '../../../core/models/team-member.model';
import { getInitials } from '../../../shared/utils/initials.util';
import { getAvatarColor } from '../../../shared/utils/avatar.util';

export interface AddMemberDialogData {
  teamId: string;
  team: Team;
  currentMemberIds: string[];
}

@Component({
  selector: 'app-add-member-dialog',
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
  templateUrl: './add-member-dialog.component.html',
  styleUrls: ['./add-member-dialog.component.scss'],
})
export class AddMemberDialogComponent implements OnInit {
  private teamService = inject(TeamService);
  private teamDirectoryService = inject(TeamDirectoryService);
  private ref = inject(MatDialogRef<AddMemberDialogComponent>);
  readonly data: AddMemberDialogData = inject(MAT_DIALOG_DATA);

  readonly memberRoles = MEMBER_ROLES;
  readonly timezones = TIMEZONES;

  step = signal(1);
  loading = signal(true);
  saving = signal(false);
  error = signal<string | null>(null);
  search = signal('');
  allUsers = signal<AppUser[]>([]);
  selectedUser = signal<AppUser | null>(null);
  role = signal<MemberRole>('member');
  capacityPoints = signal(8);
  timezone = signal(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');

  availableUsers = computed(() => {
    return filterCandidateUsers(
      this.allUsers(),
      this.data.currentMemberIds,
      this.search(),
    );
  });

  async ngOnInit(): Promise<void> {
    try {
      const users = await this.teamDirectoryService.getDirectoryUsers();
      this.allUsers.set(users);
    } catch (e: unknown) {
      this.error.set(getErrorMessage(e, 'Failed to load users'));
    } finally {
      this.loading.set(false);
    }
  }

  selectUser(user: AppUser): void {
    this.selectedUser.set(user);
    this.step.set(2);
  }

  back(): void {
    this.step.set(1);
    this.selectedUser.set(null);
    this.error.set(null);
  }

  decreaseCapacity(): void {
    this.capacityPoints.update((v) => Math.max(1, v - 1));
  }

  increaseCapacity(): void {
    this.capacityPoints.update((v) => Math.min(50, v + 1));
  }

  async submit(): Promise<void> {
    const user = this.selectedUser();
    if (!user || this.saving()) return;

    this.saving.set(true);
    this.error.set(null);

    try {
      if (this.data.currentMemberIds.includes(user.uid)) {
        throw new Error('This member is already on the team.');
      }
      await this.teamService.addMember(
        this.data.teamId,
        user.uid,
        this.data.currentMemberIds,
      );
      await this.teamService.saveTeamMemberEnrichment(
        this.data.teamId,
        user.uid,
        {
          name: user.displayName,
          email: user.email,
          avatarUrl: user.photoURL,
          role: this.role(),
          teamId: this.data.teamId,
          capacityPoints: this.capacityPoints(),
          timezone: this.timezone(),
          isActive: true,
        } as Omit<TeamMember, 'id' | 'createdAt' | 'updatedAt'>,
      );
      this.ref.close({ confirmed: true, uid: user.uid });
    } catch (e: unknown) {
      this.error.set(
        getErrorMessage(e, 'Failed to add member. Please try again.'),
      );
    } finally {
      this.saving.set(false);
    }
  }

  close(): void {
    this.ref.close(false);
  }

  protected readonly initials = getInitials;
  protected readonly avatarColor = getAvatarColor;
}
