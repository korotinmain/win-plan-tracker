import {
  buildPlanningSessionAccessFields,
  canReadLegacyPlanningSession,
  mapPlanningParticipants,
  mergePlanningSessions,
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

  it('mapPlanningParticipants does not assign ids when the saved ids are not positionally aligned', () => {
    expect(
      mapPlanningParticipants(['Alex', 'Sam', 'Taylor'], ['uid-alex', 'uid-taylor']),
    ).toEqual([
      { name: 'Alex' },
      { name: 'Sam' },
      { name: 'Taylor' },
    ]);
  });

  it('mapPlanningParticipants preserves aligned ids by participant position', () => {
    expect(
      mapPlanningParticipants(['Alex', 'Sam'], ['uid-alex', 'uid-sam']),
    ).toEqual([
      { name: 'Alex', uid: 'uid-alex' },
      { name: 'Sam', uid: 'uid-sam' },
    ]);
  });

  it('mergePlanningSessions keeps scoped sessions first and appends unique legacy sessions', () => {
    expect(
      mergePlanningSessions(
        [
          { id: 'scoped-2', updatedAt: { seconds: 20, nanoseconds: 0 } },
          { id: 'shared', updatedAt: { seconds: 10, nanoseconds: 0 } },
        ],
        [
          { id: 'legacy-1', updatedAt: { seconds: 15, nanoseconds: 0 } },
          { id: 'shared', updatedAt: { seconds: 5, nanoseconds: 0 } },
        ],
      ),
    ).toEqual([
      { id: 'scoped-2', updatedAt: { seconds: 20, nanoseconds: 0 } },
      { id: 'legacy-1', updatedAt: { seconds: 15, nanoseconds: 0 } },
      { id: 'shared', updatedAt: { seconds: 10, nanoseconds: 0 } },
    ]);
  });
});
