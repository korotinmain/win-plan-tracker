import { AppUser } from '../models/user.model';
import { filterCandidateUsers } from './team-directory.service';

describe('team-directory.service helpers', () => {
  it('filters out existing members and matches the search term against name or email', () => {
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
    ];

    expect(
      filterCandidateUsers(users, ['user-2'], 'tay').map((user) => user.uid),
    ).toEqual(['user-3']);
  });
});
