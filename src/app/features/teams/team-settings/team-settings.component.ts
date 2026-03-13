import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { TeamService } from '../../../core/services/team.service';
import { AuthService } from '../../../core/services/auth.service';
import { Team } from '../../../core/models/team.model';
import { AppUser } from '../../../core/models/user.model';
import {
  HolidayService,
  NagerCountry,
} from '../../../core/services/holiday.service';
import { getInitials } from '../../../shared/utils/initials.util';
import { getRoleColor, getRoleBg } from '../../../shared/utils/role.util';

@Component({
  selector: 'app-team-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatDividerModule,
    MatSelectModule,
    MatFormFieldModule,
  ],
  templateUrl: './team-settings.component.html',
  styleUrls: ['./team-settings.component.scss'],
})
export class TeamSettingsComponent {
  private teamService = inject(TeamService);
  private authService = inject(AuthService);
  private holidayService = inject(HolidayService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  team = signal<Team | null>(null);
  members = signal<AppUser[]>([]);
  allUsers = signal<AppUser[]>([]);
  search = signal('');
  loading = signal(true);
  saving = signal<string | null>(null);

  countries = signal<NagerCountry[]>([]);
  countriesError = signal(false);
  selectedCountry = signal('');
  countrySaving = signal(false);
  countrySaved = signal(false);
  countrySaveError = signal<string | null>(null);

  filteredUsers = computed(() => {
    const team = this.team();
    if (!team) return [];
    const q = this.search().toLowerCase();
    const ids = new Set(team.memberIds);
    return this.allUsers().filter(
      (u) =>
        !ids.has(u.uid) &&
        (u.displayName.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)),
    );
  });

  constructor() {
    this.load();
    this.loadCountries();
  }

  private async load(): Promise<void> {
    const teamId = this.route.snapshot.paramMap.get('id');
    if (!teamId) {
      this.loading.set(false);
      return;
    }
    try {
      const [team, allUsers] = await Promise.all([
        this.teamService.getTeam(teamId),
        this.teamService.getAllUsers(),
      ]);
      if (team) {
        this.team.set(team);
        this.members.set(
          allUsers.filter((u) => team.memberIds.includes(u.uid)),
        );
        this.selectedCountry.set(team.holidayCountryCode ?? '');
      }
      this.allUsers.set(allUsers);
    } catch (e) {
      console.error('[TeamSettings] load failed', e);
    } finally {
      this.loading.set(false);
    }
  }

  private async loadCountries(): Promise<void> {
    try {
      this.countries.set(await this.holidayService.getCountries());
    } catch {
      this.countriesError.set(true);
    }
  }

  async add(user: AppUser): Promise<void> {
    const team = this.team();
    if (!team) return;
    this.saving.set(user.uid);
    try {
      await this.teamService.addMember(team.id, user.uid, team.memberIds);
      this.team.update((t) =>
        t ? { ...t, memberIds: [...t.memberIds, user.uid] } : t,
      );
      this.members.update((m) => [...m, user]);
    } catch (e) {
      console.error('[TeamSettings] add member failed', e);
    } finally {
      this.saving.set(null);
    }
  }

  async remove(user: AppUser): Promise<void> {
    const team = this.team();
    if (!team) return;
    this.saving.set(user.uid);
    try {
      await this.teamService.removeMember(team.id, user.uid, team.memberIds);
      this.team.update((t) =>
        t
          ? { ...t, memberIds: t.memberIds.filter((id) => id !== user.uid) }
          : t,
      );
      this.members.update((m) => m.filter((u) => u.uid !== user.uid));
    } catch (e) {
      console.error('[TeamSettings] remove member failed', e);
    } finally {
      this.saving.set(null);
    }
  }

  async saveCountry(): Promise<void> {
    const team = this.team();
    if (!team) return;
    this.countrySaving.set(true);
    this.countrySaveError.set(null);
    try {
      const code = this.selectedCountry().trim().toUpperCase();
      this.selectedCountry.set(code);
      await this.teamService.updateHolidayCountry(team.id, code);
      this.team.update((t) =>
        t ? { ...t, holidayCountryCode: code || undefined } : t,
      );
      this.countrySaved.set(true);
      setTimeout(() => this.countrySaved.set(false), 2500);
    } catch (e: any) {
      this.countrySaveError.set(e?.message ?? 'Failed to save.');
    } finally {
      this.countrySaving.set(false);
    }
  }

  goBack(): void {
    this.router.navigate(['/teams']);
  }

  protected readonly initials = getInitials;
  protected readonly roleBg = getRoleBg;
  protected readonly roleColor = getRoleColor;
}
