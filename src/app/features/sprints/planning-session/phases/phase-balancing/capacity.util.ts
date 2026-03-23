import {
  CapacityEntry,
  IssueReview,
} from '../../../../../core/models/planning-session.model';

/** Issues that count toward committed workload. */
const COMMITTED_OUTCOMES = new Set(['confirmed', 'risky-accepted']);

/**
 * Derives per-person capacity entries from a list of issue reviews and
 * participant names.
 *
 * Rules:
 * - Only issues with outcome `confirmed` or `risky-accepted` count.
 * - Issues with no assignee are placed in an "Unassigned" bucket using uid=''.
 * - `availableSP` is 0 by default (not yet computable from Jira data alone).
 * - `isOverloaded` is true when plannedSP > availableSP AND availableSP > 0.
 *
 * Stateless pure function — safe to call in tests without Angular.
 */
export function computeCapacity(
  reviews: IssueReview[],
  participantIds: string[],
  participantNames: string[],
): CapacityEntry[] {
  // Seed one entry per participant
  const map = new Map<string, CapacityEntry>();
  for (let i = 0; i < participantIds.length; i++) {
    const uid = participantIds[i];
    map.set(uid, {
      uid,
      name: participantNames[i] ?? uid,
      plannedSP: 0,
      availableSP: 0,
      isOverloaded: false,
    });
  }

  // Accumulate SP for committed issues
  for (const r of reviews) {
    if (!r.outcome || !COMMITTED_OUTCOMES.has(r.outcome)) continue;
    const key = r.assignee ?? '';
    if (!map.has(key)) {
      // Unassigned or someone not in participants list
      map.set(key, {
        uid: key,
        name: r.assignee ?? 'Unassigned',
        plannedSP: 0,
        availableSP: 0,
        isOverloaded: false,
      });
    }
    const entry = map.get(key)!;
    entry.plannedSP += r.storyPoints ?? 0;
  }

  // Mark overloaded (only when availableSP is known > 0)
  for (const entry of map.values()) {
    entry.isOverloaded = entry.availableSP > 0 && entry.plannedSP > entry.availableSP;
  }

  return Array.from(map.values()).sort((a, b) => b.plannedSP - a.plannedSP);
}

/** Returns the max plannedSP across all entries, or 1 as a floor. */
export function maxPlannedSP(entries: CapacityEntry[]): number {
  return Math.max(1, ...entries.map((e) => e.plannedSP));
}
