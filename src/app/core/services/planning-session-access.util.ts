export interface PlanningSessionAccessFields {
  teamId: string;
  createdBy: string;
  participantIds: string[];
}

export interface PlanningParticipant {
  name: string;
  uid?: string;
}

export interface PlanningSessionMetadataPatchInput {
  teamId?: string;
  participantIds?: string[];
}

export function buildPlanningSessionAccessFields(
  fields: PlanningSessionAccessFields,
): PlanningSessionAccessFields {
  if (!fields.teamId.trim()) {
    throw new Error('Planning sessions require a teamId.');
  }

  return {
    teamId: fields.teamId.trim(),
    createdBy: fields.createdBy,
    participantIds: Array.from(new Set(fields.participantIds)),
  };
}

export function buildPlanningSessionMetadataPatch(
  input: PlanningSessionMetadataPatchInput,
): Partial<Pick<PlanningSessionAccessFields, 'teamId' | 'participantIds'>> {
  const teamId = input.teamId?.trim();
  if (!teamId) {
    return {};
  }

  return {
    teamId,
    participantIds: Array.from(new Set(input.participantIds ?? [])),
  };
}

export function canReadLegacyPlanningSession(
  session: { createdBy?: string; teamId?: string },
  uid: string,
): boolean {
  return !session.teamId && session.createdBy === uid;
}

export function mapPlanningParticipants(
  participants: string[],
  participantIds?: string[],
): PlanningParticipant[] {
  const hasAlignedIds = participantIds?.length === participants.length;

  return participants.map((name, index) => {
    const uid =
      hasAlignedIds && participantIds?.[index]?.trim()
        ? participantIds[index].trim()
        : undefined;

    return uid ? { name, uid } : { name };
  });
}

export function mergePlanningSessions<T extends {
  id?: string;
  updatedAt?: unknown;
  createdAt?: unknown;
}>(primary: T[], fallback: T[]): T[] {
  const merged: T[] = [];
  const seenIds = new Set<string>();

  for (const session of [...primary, ...fallback]) {
    if (session.id) {
      if (seenIds.has(session.id)) continue;
      seenIds.add(session.id);
    }

    merged.push(session);
  }

  return merged.sort((a, b) => getSessionTime(b) - getSessionTime(a));
}

function getSessionTime(session: {
  updatedAt?: unknown;
  createdAt?: unknown;
}): number {
  return getTimeValue(session.updatedAt) || getTimeValue(session.createdAt);
}

function getTimeValue(value: unknown): number {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();

  const timestamp = value as {
    toMillis?: () => number;
    seconds?: number;
    nanoseconds?: number;
  };

  if (typeof timestamp.toMillis === 'function') {
    return timestamp.toMillis();
  }

  if (typeof timestamp.seconds === 'number') {
    return timestamp.seconds * 1000 + Math.floor((timestamp.nanoseconds ?? 0) / 1_000_000);
  }

  return 0;
}
