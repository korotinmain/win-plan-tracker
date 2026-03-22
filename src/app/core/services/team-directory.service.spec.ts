import { Team } from '../models/team.model';
import { AppUser } from '../models/user.model';
import {
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
