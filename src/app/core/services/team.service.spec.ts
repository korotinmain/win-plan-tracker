import {
  resolveAddMemberMutation,
  resolveJoinTeamMutation,
  resolveRemoveMemberMutation,
} from './team.service';
import { Team } from '../models/team.model';
import { AppUser } from '../models/user.model';

describe('TeamService membership mutations', () => {
  it('addMember rejects other-team users but repairs a missing team-side membership for same-team users', () => {
    const missingTeamMember = createTeam([]);
    const sameTeamUser = createUser('team-1');
    const otherTeamUser = createUser('other-team');

    expect(resolveAddMemberMutation(missingTeamMember, 'team-1', sameTeamUser)).toEqual(
      {
        teamMemberIds: ['user-1'],
        updateTeam: true,
      },
    );
    expect(() =>
      resolveAddMemberMutation(missingTeamMember, 'team-1', otherTeamUser),
    ).toThrowError('This member is already on a team. Leave it first.');
  });

  it('joinTeam remains no-team-only and repairs a missing user-side membership when the team already contains the user', () => {
    const splitStateTeam = createTeam(['user-1']);
    const noTeamUser = createUser('');
    const otherTeamUser = createUser('other-team');

    expect(resolveJoinTeamMutation(splitStateTeam, 'team-1', noTeamUser)).toEqual(
      {
        teamMemberIds: ['user-1'],
        updateTeam: false,
        updateUserTeamId: 'team-1',
      },
    );
    expect(() =>
      resolveJoinTeamMutation(splitStateTeam, 'team-1', otherTeamUser),
    ).toThrowError('You are already a member of a team. Leave it first.');
  });

  it('removeMember cleans up a stale team-side membership without forcing a user-doc write', () => {
    const splitStateTeam = createTeam(['user-1', 'other-member']);
    const noTeamUser = createUser('');

    expect(resolveRemoveMemberMutation(splitStateTeam, 'team-1', noTeamUser)).toEqual(
      {
        teamMemberIds: ['other-member'],
        updateTeam: true,
        updateUserTeamId: undefined,
      },
    );
  });

  it('removeMember clears the user-side membership when the team record is already clean', () => {
    const cleanTeam = createTeam(['other-member']);
    const sameTeamUser = createUser('team-1');

    expect(resolveRemoveMemberMutation(cleanTeam, 'team-1', sameTeamUser)).toEqual({
      teamMemberIds: ['other-member'],
      updateTeam: false,
      updateUserTeamId: '',
    });
  });

  it('rejects removeMember when the user belongs to another team', () => {
    const team = createTeam(['user-1', 'other-member']);
    const user = createUser('other-team');

    expect(() =>
      resolveRemoveMemberMutation(team, 'team-1', user),
    ).toThrowError('This member belongs to another team.');
  });
});

function createTeam(memberIds: string[]): Team {
  return {
    id: 'team-1',
    name: 'Team One',
    icon: 'rocket',
    managerId: 'manager-1',
    memberIds,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };
}

function createUser(teamId: string): AppUser {
  return {
    uid: 'user-1',
    email: 'user@example.com',
    displayName: 'User One',
    role: 'employee',
    teamId,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };
}
