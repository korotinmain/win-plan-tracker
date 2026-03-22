import { TestBed } from '@angular/core/testing';
import { Functions } from '@angular/fire/functions';
import { TeamService, teamMembershipCallable } from './team.service';
import { TeamDirectoryService } from './team-directory.service';

describe('TeamService membership mutations', () => {
  let service: TeamService;
  let callable: jasmine.Spy;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: Functions, useValue: {} },
        { provide: TeamDirectoryService, useValue: {} },
      ],
    });

    callable = spyOn(teamMembershipCallable, 'updateTeamMembership').and.callFake(
      async (_functions: Functions, payload: any) => ({
        action: payload.action,
        teamId: payload.teamId,
        userId: payload.userId ?? 'user-1',
        status: 'updated',
      }),
    );

    service = TestBed.inject(TeamService);
  });

  it('addMember invokes the callable with add', async () => {
    await service.addMember('team-1', 'user-1', []);

    expect(callable).toHaveBeenCalledWith(
      jasmine.anything(),
      {
        action: 'add',
        teamId: 'team-1',
        userId: 'user-1',
      },
    );
  });

  it('joinTeam invokes the callable with join', async () => {
    await service.joinTeam('team-1', 'user-1', []);

    expect(callable).toHaveBeenCalledWith(jasmine.anything(), {
      action: 'join',
      teamId: 'team-1',
      userId: 'user-1',
    });
  });

  it('removeMember invokes the callable with remove', async () => {
    await service.removeMember('team-1', 'user-1', []);

    expect(callable).toHaveBeenCalledWith(jasmine.anything(), {
      action: 'remove',
      teamId: 'team-1',
      userId: 'user-1',
    });
  });

  it('leaveTeam invokes the callable with leave', async () => {
    await service.leaveTeam('team-1', 'user-1');

    expect(callable).toHaveBeenCalledWith(jasmine.anything(), {
      action: 'leave',
      teamId: 'team-1',
      userId: 'user-1',
    });
  });

  it('rejects noop callable responses for addMember', async () => {
    callable.and.returnValue(
      Promise.resolve({
        action: 'add',
        teamId: 'team-1',
        userId: 'user-1',
        status: 'noop',
      }),
    );

    await expectAsync(
      service.addMember('team-1', 'user-1', []),
    ).toBeRejectedWithError(
      'This membership change no longer applied. Refresh and try again.',
    );
  });

  it('propagates callable backend failures', async () => {
    callable.and.returnValue(Promise.reject(new Error('backend failed')));

    await expectAsync(
      service.joinTeam('team-1', 'user-1', []),
    ).toBeRejectedWithError('backend failed');
  });
});
