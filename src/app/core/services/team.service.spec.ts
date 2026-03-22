import { TestBed } from '@angular/core/testing';
import { TeamService, firestoreApi } from './team.service';
import { TeamDirectoryService } from './team-directory.service';
import { Team } from '../models/team.model';
import { AppUser } from '../models/user.model';

describe('TeamService membership mutations', () => {
  let service: TeamService;
  let state: {
    team: Team;
    user: AppUser;
    memberships: string[];
  };
  let transaction: {
    get: jasmine.Spy;
    update: jasmine.Spy;
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: TeamDirectoryService, useValue: {} }],
    });

    service = TestBed.inject(TeamService);
    state = {
      team: createTeam([]),
      user: createUser(''),
      memberships: [],
    };
    transaction = createTransactionHarness(state);

    spyOn(firestoreApi as any, 'doc').and.callFake(
      (_db: unknown, path: string) => ({ path }) as any,
    );
    spyOn(firestoreApi as any, 'getDoc').and.callFake(async (ref: { path: string }) => {
      if (ref.path === 'users/user-1') {
        return createSnapshot(state.user);
      }
      if (ref.path === 'teams/team-1') {
        return createSnapshot(state.team);
      }
      return createSnapshot(undefined);
    });
    spyOn(firestoreApi as any, 'getDocs').and.callFake(async () =>
      createQuerySnapshot(state.memberships) as any,
    );
    spyOn(firestoreApi as any, 'runTransaction').and.callFake(
      async (_db: unknown, callback: (tx: any) => Promise<any>) => {
        transaction = createTransactionHarness(state);
        return callback(transaction as any);
      },
    );
  });

  it('addMember writes only the team doc when repairing same-team membership', async () => {
    state.team = createTeam([]);
    state.user = createUser('team-1');
    state.memberships = ['team-1'];

    await service.addMember('team-1', 'user-1', []);

    expect(transaction.update.calls.allArgs()).toEqual([
      [{ path: 'teams/team-1' }, { memberIds: ['user-1'] }],
    ]);
  });

  it('addMember writes only the user doc when the team already contains the user', async () => {
    state.team = createTeam(['user-1']);
    state.user = createUser('');
    state.memberships = ['team-1'];

    await service.addMember('team-1', 'user-1', []);

    expect(transaction.update.calls.allArgs()).toEqual([
      [{ path: 'users/user-1' }, { teamId: 'team-1' }],
    ]);
  });

  it('addMember writes both docs on the normal success path', async () => {
    state.team = createTeam([]);
    state.user = createUser('');

    await service.addMember('team-1', 'user-1', []);

    expect(transaction.update.calls.allArgs()).toEqual([
      [{ path: 'teams/team-1' }, { memberIds: ['user-1'] }],
      [{ path: 'users/user-1' }, { teamId: 'team-1' }],
    ]);
  });

  it('joinTeam repairs a stale team-side membership by writing only the user doc', async () => {
    state.team = createTeam(['user-1']);
    state.user = createUser('');
    state.memberships = ['team-1'];

    await service.joinTeam('team-1', 'user-1', []);

    expect(transaction.update.calls.allArgs()).toEqual([
      [{ path: 'users/user-1' }, { teamId: 'team-1' }],
    ]);
  });

  it('removeMember skips the user doc when the user team id is already empty', async () => {
    state.team = createTeam(['user-1', 'other-member']);
    state.user = createUser('');

    await service.removeMember('team-1', 'user-1', []);

    expect(transaction.update.calls.allArgs()).toEqual([
      [{ path: 'teams/team-1' }, { memberIds: ['other-member'] }],
    ]);
  });

  it('joinTeam rejects when the user is listed on another team', async () => {
    state.user = createUser('');
    state.memberships = ['team-2'];

    await expectAsync(service.joinTeam('team-1', 'user-1', [])).toBeRejectedWithError(
      'You are already a member of a team. Leave it first.',
    );
    expect((firestoreApi.runTransaction as jasmine.Spy)).not.toHaveBeenCalled();
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

function createSnapshot<T>(data: T | undefined) {
  return {
    exists: () => data !== undefined,
    data: () => data,
  };
}

function createQuerySnapshot(teamIds: string[]) {
  return {
    docs: teamIds.map((id) => ({ id })),
    empty: teamIds.length === 0,
  };
}

function createTransactionHarness(state: {
  team: Team;
  user: AppUser;
  memberships: string[];
}) {
  const updates: Array<{ ref: { path: string }; data: Record<string, unknown> }> = [];
  return {
    get: jasmine.createSpy('get').and.callFake(async (ref: { path: string }) => {
      if (ref.path === 'teams/team-1') {
        return createSnapshot(state.team);
      }
      if (ref.path === 'users/user-1') {
        return createSnapshot(state.user);
      }
      return createSnapshot(undefined);
    }),
    update: jasmine.createSpy('update').and.callFake(
      (ref: { path: string }, data: Record<string, unknown>) => {
        updates.push({ ref, data });
      },
    ),
    updates,
  };
}
