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
import {
  TeamDirectoryService,
  TeamMembershipCandidate,
  filterCandidateUsers,
} from '../../../core/services/team-directory.service';
import { getErrorMessage } from '../../../shared/utils/error.util';
import { Team } from '../../../core/models/team.model';
import { AppUser } from '../../../core/models/user.model';
import {
  HolidayService,
  NagerCountry,
} from '../../../core/services/holiday.service';
import { getInitials } from '../../../shared/utils/initials.util';
import { getRoleColor, getRoleBg } from '../../../shared/utils/role.util';

export interface ManageTeamDialogData {
  team: Team;
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
  private teamDirectoryService = inject(TeamDirectoryService);
  private holidayService = inject(HolidayService);
  private ref = inject(MatDialogRef<ManageTeamDialogComponent>);
  readonly data: ManageTeamDialogData = inject(MAT_DIALOG_DATA);

  team = signal<Team>({ ...this.data.team });
  members = signal<AppUser[]>([]);
  candidates = signal<TeamMembershipCandidate[]>([]);
  search = signal('');
  loading = signal(true);
  saving = signal<string | null>(null);

  countries = signal<NagerCountry[]>([]);
  countriesError = signal(false);
  selectedCountry = signal(this.data.team.holidayCountryCode ?? '');
  countrySaving = signal(false);
  countrySaved = signal(false);
  countrySaveError = signal<string | null>(null);
  candidateLoadError = signal<string | null>(null);
  memberLoadError = signal<string | null>(null);

  filteredUsers = computed(() => {
    return filterCandidateUsers(
      this.candidates(),
      this.team().memberIds,
      this.search(),
      this.team().id,
    );
  });

  constructor() {
    this.load();
    this.loadCountries();
  }

  private async loadCountries(): Promise<void> {
    try {
      this.countries.set(await this.holidayService.getCountries());
    } catch {
      this.countriesError.set(true);
    }
  }

  private async load(): Promise<void> {
    try {
      await this.refreshMembershipData();
    } catch (e) {
      console.error('[ManageTeamDialog] load failed', e);
    } finally {
      this.loading.set(false);
    }
  }

  private async refreshMembershipData(): Promise<void> {
    const teamId = this.team().id;
    const [membersResult, candidatesResult] = await Promise.allSettled([
      this.teamService.getTeamMembers(teamId),
      this.teamDirectoryService.getMembershipCandidates(teamId),
    ]);

    if (membersResult.status === 'fulfilled') {
      this.members.set(membersResult.value);
      this.memberLoadError.set(null);
    } else {
      console.error('[ManageTeamDialog] member load failed', membersResult.reason);
      this.memberLoadError.set(
        getErrorMessage(
          membersResult.reason,
          'Failed to load team members.',
        ),
      );
    }

    if (candidatesResult.status === 'fulfilled') {
      this.candidates.set(candidatesResult.value);
      this.candidateLoadError.set(null);
    } else {
      console.error(
        '[ManageTeamDialog] candidate load failed',
        candidatesResult.reason,
      );
      this.candidateLoadError.set(
        getErrorMessage(
          candidatesResult.reason,
          'Failed to load membership candidates.',
        ),
      );
    }
  }

  async add(user: TeamMembershipCandidate): Promise<void> {
    this.saving.set(user.uid);
    try {
      await this.teamService.addMember(
        this.team().id,
        user.uid,
        this.team().memberIds,
      );
      this.team.update((t) => ({
        ...t,
        memberIds: [...t.memberIds, user.uid],
      }));
      await this.refreshMembershipData();
    } catch (e) {
      console.error('[ManageTeamDialog] add member failed', e);
    } finally {
      this.saving.set(null);
    }
  }

  async remove(user: AppUser): Promise<void> {
    this.saving.set(user.uid);
    try {
      await this.teamService.removeMember(
        this.team().id,
        user.uid,
        this.team().memberIds,
      );
      this.team.update((t) => ({
        ...t,
        memberIds: t.memberIds.filter((id) => id !== user.uid),
      }));
      await this.refreshMembershipData();
    } catch (e) {
      console.error('[ManageTeamDialog] remove member failed', e);
    } finally {
      this.saving.set(null);
    }
  }

  protected readonly initials = getInitials;
  protected readonly roleBg = getRoleBg;
  protected readonly roleColor = getRoleColor;

  async saveCountry(): Promise<void> {
    this.countrySaving.set(true);
    this.countrySaveError.set(null);
    try {
      const code = this.selectedCountry().trim().toUpperCase();
      this.selectedCountry.set(code);
      await this.teamService.updateHolidayCountry(this.team().id, code);
      this.team.update((t) => ({
        ...t,
        holidayCountryCode: code || undefined,
      }));
      this.countrySaved.set(true);
      setTimeout(() => this.countrySaved.set(false), 2500);
    } catch (e: unknown) {
      this.countrySaveError.set(getErrorMessage(e, 'Failed to save.'));
    } finally {
      this.countrySaving.set(false);
    }
  }

  close(): void {
    this.ref.close();
  }
}
