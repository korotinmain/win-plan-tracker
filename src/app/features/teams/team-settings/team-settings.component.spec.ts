import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { HolidayService } from '../../../core/services/holiday.service';
import {
  TeamDirectoryService,
  TeamMembershipCandidate,
} from '../../../core/services/team-directory.service';
import { TeamService } from '../../../core/services/team.service';
import { Team } from '../../../core/models/team.model';
import { AppUser } from '../../../core/models/user.model';
import { TeamSettingsComponent } from './team-settings.component';

describe('TeamSettingsComponent', () => {
  let teamService: jasmine.SpyObj<TeamService>;
  let teamDirectoryService: jasmine.SpyObj<TeamDirectoryService>;

  beforeEach(() => {
    spyOn(console, 'error');

    teamService = jasmine.createSpyObj<TeamService>('TeamService', [
      'getTeam',
      'getTeamMembers',
      'addMember',
      'removeMember',
      'updateHolidayCountry',
    ]);
    teamDirectoryService = jasmine.createSpyObj<TeamDirectoryService>(
      'TeamDirectoryService',
      ['getMembershipCandidates'],
    );

    TestBed.configureTestingModule({
      providers: [
        { provide: TeamService, useValue: teamService },
        { provide: TeamDirectoryService, useValue: teamDirectoryService },
        { provide: HolidayService, useValue: { getCountries: async () => [] } },
        { provide: AuthService, useValue: {} },
        { provide: Router, useValue: { navigate: jasmine.createSpy('navigate') } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: (key: string) => (key === 'id' ? 'team-1' : null),
              },
            },
          },
        },
      ],
    });
  });

  it('loads current members from TeamService and candidates from TeamDirectoryService', async () => {
    const team = createTeam();
    const members = [createMember()];
    const candidates = [createCandidate('candidate-1')];

    teamService.getTeam.and.resolveTo(team);
    teamService.getTeamMembers.and.resolveTo(members);
    teamDirectoryService.getMembershipCandidates.and.resolveTo(candidates);

    const component = TestBed.runInInjectionContext(
      () => new TeamSettingsComponent(),
    );
    await flushPromises();

    expect(teamService.getTeam).toHaveBeenCalledWith('team-1');
    expect(teamService.getTeamMembers).toHaveBeenCalledWith('team-1');
    expect(teamDirectoryService.getMembershipCandidates).toHaveBeenCalledWith(
      'team-1',
    );
    expect(component.members()).toEqual(members);
    expect(component.candidates()).toEqual(candidates);
  });

  it('does not derive current members from candidate data', async () => {
    const team = createTeam();
    const members = [createMember('member-1', 'Existing Member')];
    const candidates = [createCandidate('member-1', 'Candidate Name')];

    teamService.getTeam.and.resolveTo(team);
    teamService.getTeamMembers.and.resolveTo(members);
    teamDirectoryService.getMembershipCandidates.and.resolveTo(candidates);

    const component = TestBed.runInInjectionContext(
      () => new TeamSettingsComponent(),
    );
    await flushPromises();

    expect(component.members()).toEqual(members);
    expect(component.members()[0].displayName).toBe('Existing Member');
  });

  it('keeps the loaded team visible when candidate loading fails', async () => {
    const team = createTeam();
    const members = [createMember()];

    teamService.getTeam.and.resolveTo(team);
    teamService.getTeamMembers.and.resolveTo(members);
    teamDirectoryService.getMembershipCandidates.and.rejectWith(
      new Error('candidate load failed'),
    );

    const component = TestBed.runInInjectionContext(
      () => new TeamSettingsComponent(),
    );
    await flushPromises();

    expect(component.loading()).toBeFalse();
    expect(component.team()).toEqual(team);
    expect(component.members()).toEqual(members);
    expect(component.candidates()).toEqual([]);
    expect(component.candidateLoadError()).toBe('candidate load failed');
  });
});

function createTeam(): Team {
  return {
    id: 'team-1',
    name: 'Team One',
    icon: 'groups',
    managerId: 'manager-1',
    memberIds: ['member-1'],
    createdAt: new Date('2026-01-01'),
  };
}

function createMember(
  uid = 'member-1',
  displayName = 'Member One',
): AppUser {
  return {
    uid,
    displayName,
    email: `${uid}@example.com`,
    role: 'employee',
    teamId: 'team-1',
    createdAt: new Date('2026-01-01'),
  };
}

function createCandidate(
  uid: string,
  displayName = 'Candidate One',
): TeamMembershipCandidate {
  return {
    uid,
    displayName,
    email: `${uid}@example.com`,
    teamId: 'team-1',
  };
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}
