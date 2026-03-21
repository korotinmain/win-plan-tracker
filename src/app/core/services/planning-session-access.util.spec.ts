import {
  buildPlanningSessionAccessFields,
  canReadLegacyPlanningSession,
} from './planning-session-access.util';

describe('planning-session-access.util', () => {
  it('buildPlanningSessionAccessFields returns the provided fields', () => {
    expect(
      buildPlanningSessionAccessFields({
        teamId: 'team-1',
        createdBy: 'user-1',
        participantIds: ['user-1', 'user-2'],
      }),
    ).toEqual({
      teamId: 'team-1',
      createdBy: 'user-1',
      participantIds: ['user-1', 'user-2'],
    });
  });

  it('buildPlanningSessionAccessFields deduplicates participant ids', () => {
    expect(
      buildPlanningSessionAccessFields({
        teamId: 'team-1',
        createdBy: 'user-1',
        participantIds: ['user-1', 'user-2', 'user-1', 'user-2'],
      }),
    ).toEqual({
      teamId: 'team-1',
      createdBy: 'user-1',
      participantIds: ['user-1', 'user-2'],
    });
  });

  it('buildPlanningSessionAccessFields rejects an empty team id', () => {
    expect(() =>
      buildPlanningSessionAccessFields({
        teamId: '   ',
        createdBy: 'user-1',
        participantIds: ['user-1', 'user-2'],
      }),
    ).toThrowError('Planning sessions require a teamId.');
  });

  it('canReadLegacyPlanningSession allows the creator when teamId is missing', () => {
    expect(
      canReadLegacyPlanningSession(
        { createdBy: 'user-1', teamId: undefined },
        'user-1',
      ),
    ).toBeTrue();
  });

  it('canReadLegacyPlanningSession returns false when teamId is present', () => {
    expect(
      canReadLegacyPlanningSession(
        { createdBy: 'user-1', teamId: 'team-1' },
        'user-1',
      ),
    ).toBeFalse();
  });

  it('canReadLegacyPlanningSession returns false when createdBy does not match uid', () => {
    expect(
      canReadLegacyPlanningSession(
        { createdBy: 'user-1', teamId: undefined },
        'user-2',
      ),
    ).toBeFalse();
  });

  it('canReadLegacyPlanningSession returns false for legacy docs without createdBy', () => {
    expect(
      canReadLegacyPlanningSession({ teamId: undefined }, 'user-1'),
    ).toBeFalse();
  });
});
