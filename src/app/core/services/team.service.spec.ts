import {
  resolveAddMemberMemberIds,
  resolveJoinTeamMemberIds,
  resolveRemoveMemberMemberIds,
} from './team.service';
import { Team } from '../models/team.model';
import { AppUser } from '../models/user.model';

describe('TeamService membership mutations', () => {
  it('adds members from the latest team state and rejects assigned users', () => {
    const team = createTeam(['existing-member']);
    const noTeamUser = createUser('');
    const assignedUser = createUser('other-team');

    expect(resolveAddMemberMemberIds(team, 'team-1', noTeamUser)).toEqual([
      'existing-member',
      'user-1',
    ]);
    expect(() =>
      resolveAddMemberMemberIds(team, 'team-1', assignedUser),
    ).toThrowError('This member is already on a team. Leave it first.');
  });

  it('keeps joinTeam no-team-only', () => {
    const team = createTeam(['existing-member']);
    const noTeamUser = createUser('');
    const assignedUser = createUser('other-team');

    expect(resolveJoinTeamMemberIds(team, 'team-1', noTeamUser)).toEqual([
      'existing-member',
      'user-1',
    ]);
    expect(() =>
      resolveJoinTeamMemberIds(team, 'team-1', assignedUser),
    ).toThrowError('You are already a member of a team. Leave it first.');
  });

  it('removes members while preserving other team memberships', () => {
    const team = createTeam(['user-1', 'other-member']);
    const user = createUser('team-1');

    expect(resolveRemoveMemberMemberIds(team, 'team-1', user)).toEqual([
      'other-member',
    ]);
  });

  it('rejects removeMember when the user belongs to another team', () => {
    const team = createTeam(['user-1', 'other-member']);
    const user = createUser('other-team');

    expect(() =>
      resolveRemoveMemberMemberIds(team, 'team-1', user),
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
