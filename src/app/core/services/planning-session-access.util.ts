export interface PlanningSessionAccessFields {
  teamId: string;
  createdBy: string;
  participantIds: string[];
}

export function buildPlanningSessionAccessFields(
  fields: PlanningSessionAccessFields,
): PlanningSessionAccessFields {
  return {
    teamId: fields.teamId,
    createdBy: fields.createdBy,
    participantIds: Array.from(new Set(fields.participantIds)),
  };
}

export function canReadLegacyPlanningSession(
  session: { createdBy?: string; teamId?: string },
  uid: string,
): boolean {
  return !session.teamId && session.createdBy === uid;
}
