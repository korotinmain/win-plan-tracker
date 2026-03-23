import { TestBed } from '@angular/core/testing';
import { Functions } from '@angular/fire/functions';
import { Team } from '../models/team.model';
import { AppUser } from '../models/user.model';
import {
  TeamDirectoryService,
  teamMembershipCandidatesCallable,
  TeamMembershipCandidate,
  filterCandidateUsers,
  filterJoinableTeams,
} from './team-directory.service';

describe('team-directory.service helpers', () => {
  it('filters out existing members and assigned users by default', () => {
    const users: AppUser[] = [
      {
        uid: 'user-1',
        displayName: 'Alex Johnson',
        email: 'alex@example.com',
        role: 'employee',
        teamId: '',
        createdAt: new Date('2026-01-01'),
      },
      {
        uid: 'user-2',
        displayName: 'Sam Rivera',
        email: 'sam@example.com',
        role: 'employee',
        teamId: '',
        createdAt: new Date('2026-01-01'),
      },
      {
        uid: 'user-3',
        displayName: 'Taylor Kim',
        email: 'taylor@example.com',
        role: 'manager',
        teamId: '',
        createdAt: new Date('2026-01-01'),
      },
      {
        uid: 'user-4',
        displayName: 'Taylor Stone',
        email: 'taylor@example.com',
        role: 'employee',
        teamId: 'team-2',
        createdAt: new Date('2026-01-01'),
      },
    ];

    expect(
      filterCandidateUsers(users, ['user-2'], 'tay').map((user) => user.uid),
    ).toEqual(['user-3']);
  });

  it('allows same-team repair candidates when a current team id is provided', () => {
    const users: AppUser[] = [
      {
        uid: 'user-1',
        displayName: 'Sam Carter',
        email: 'sam.carter@example.com',
        role: 'employee',
        teamId: '',
        createdAt: new Date('2026-01-01'),
      },
      {
        uid: 'user-2',
        displayName: 'Sam Rivera',
        email: 'sam@example.com',
        role: 'employee',
        teamId: 'team-2',
        createdAt: new Date('2026-01-01'),
      },
      {
        uid: 'user-3',
        displayName: 'Sam Taylor',
        email: 'sam.taylor@example.com',
        role: 'employee',
        teamId: 'team-1',
        createdAt: new Date('2026-01-01'),
      },
    ];

    expect(
      filterCandidateUsers(users, [], 'sam', 'team-1').map((user) => user.uid),
    ).toEqual(['user-1', 'user-3']);
  });

  it('filters joinable teams for a user and matches search text', () => {
    const teams: Team[] = [
      {
        id: 'a',
        name: 'Alpha',
        icon: 'A',
        managerId: 'm1',
        memberIds: [],
        createdAt: new Date('2026-01-01'),
      },
      {
        id: 'b',
        name: 'Beta',
        icon: 'B',
        managerId: 'm2',
        memberIds: ['user-1'],
        createdAt: new Date('2026-01-01'),
      },
      {
        id: 'g',
        name: 'Gamma',
        icon: 'G',
        managerId: 'm3',
        memberIds: [],
        createdAt: new Date('2026-01-01'),
      },
    ];

    expect(
      filterJoinableTeams(teams, 'user-1', 'ga').map((team) => team.id),
    ).toEqual(['g']);
  });
});

describe('TeamDirectoryService membership candidates', () => {
  let service: TeamDirectoryService;
  let callable: jasmine.Spy;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: Functions, useValue: {} }],
    });

    callable = spyOn(
      teamMembershipCandidatesCallable,
      'getTeamMembershipCandidates',
    ).and.callFake(async (_functions: Functions, payload: any) => ({
      candidates: [
        {
          uid: 'user-1',
          displayName: 'Alex Johnson',
          email: 'alex@example.com',
          photoURL: 'https://example.com/avatar.png',
          teamId: 'team-1',
        },
      ],
      payload,
    }));

    service = TestBed.inject(TeamDirectoryService);
  });

  it('maps callable candidates into the frontend candidate type', async () => {
    const candidates: TeamMembershipCandidate[] =
      await service.getMembershipCandidates('team-1');

    expect(candidates).toEqual([
      {
        uid: 'user-1',
        displayName: 'Alex Johnson',
        email: 'alex@example.com',
        photoURL: 'https://example.com/avatar.png',
        teamId: 'team-1',
      },
    ]);
  });

  it('passes only teamId when no search text is provided', async () => {
    await service.getMembershipCandidates('team-1');

    expect(callable).toHaveBeenCalledWith(jasmine.anything(), {
      teamId: 'team-1',
    });
  });

  it('passes teamId and optional search to the callable wrapper', async () => {
    await service.getMembershipCandidates('team-1', 'alex');

    expect(callable).toHaveBeenCalledWith(jasmine.anything(), {
      teamId: 'team-1',
      search: 'alex',
    });
  });
});
