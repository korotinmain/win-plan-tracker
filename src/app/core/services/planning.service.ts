import { Injectable, inject } from '@angular/core';
import {
  QueryConstraint,
  Timestamp,
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where,
} from '@firebase/firestore';
import { Observable } from 'rxjs';
import { db } from '../../firebase';
import { docObservable } from '../../shared/utils/firestore.util';
import { AuthService } from './auth.service';
import {
  buildPlanningSessionAccessFields,
  buildPlanningSessionMetadataPatch,
  canReadLegacyPlanningSession,
  mergePlanningSessions,
} from './planning-session-access.util';
import {
  CapacityEntry,
  CreateSessionV2Payload,
  IssueReview,
  PlanningPhase,
  PlanningSessionSummary,
  PlanningSessionV2,
  computeSessionSummary,
  isPlanningSessionV2,
} from '../models/planning-session.model';

export type PlanningStep = 'review' | 'estimate' | 'plan' | 'review-sprint';
export type PlanningBucket = 'backlog' | 'candidate' | 'planned';
export type EstimateConfidence =
  | 'confident'
  | 'uncertain'
  | 'needs-split'
  | 'blocked';
export type CommitmentLevel = 'must' | 'stretch';

export interface TaskPlacement {
  issueId: string;
  issueKey: string;
  title: string;
  assigneeName: string | null;
  storyPoints: number;
  plannedOwnerName: string | null;
  laneParticipantIndex: number; // -1 = unplanned / backlog
  orderIndex: number;
  status: string;
  statusCategory: string;
  type: string;
  priority: string;
  dayStartIdx?: number;
  dayEndIdx?: number;
  stageBucket?: PlanningBucket;
  estimateConfidence?: EstimateConfidence;
  commitment?: CommitmentLevel;
  scopeReady?: boolean;
  dependenciesReady?: boolean;
  ownerReady?: boolean;
  unblocked?: boolean;
}

export interface PlanningSummary {
  totalStoryPoints: number;
  plannedTasks: number;
  unplannedTasks: number;
  missingStoryPoints: number;
  overloadedCount: number;
  participantSP: Record<string, number>;
  candidateTasks?: number;
  estimatedTasks?: number;
  uncertainTasks?: number;
  blockedTasks?: number;
  stretchTasks?: number;
  readyTasks?: number;
}

export interface PlanningSession {
  id?: string;
  sprintId: string | number;
  sprintName: string;
  status: 'draft' | 'completed' | 'cancelled';
  teamId?: string;
  participants: string[];
  participantIds?: string[];
  turnOrder: string[];
  turnOrderIndex?: number;
  guidedModeEnabled: boolean;
  workflowStep?: PlanningStep;
  tasks: TaskPlacement[];
  summary: PlanningSummary;
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  completedAt?: Timestamp;
  totalStoryPoints: number;
  issueCount: number;
}

export interface DraftSavePayload {
  sprintId: string | number;
  sprintName: string;
  teamId?: string;
  participants: string[];
  participantIds?: string[];
  turnOrder: string[];
  guidedModeEnabled: boolean;
  workflowStep: PlanningStep;
  tasks: TaskPlacement[];
  summary: PlanningSummary;
}

@Injectable({ providedIn: 'root' })
export class PlanningService {
  private auth = inject(AuthService);
  private col = collection(db, 'planningSessions');

  async saveDraft(data: DraftSavePayload): Promise<string> {
    const user = this.auth.currentUser;
    const teamId = user?.teamId?.trim();
    if (!teamId) {
      throw new Error('Planning sessions require a teamId.');
    }

    const access = buildPlanningSessionAccessFields({
      teamId,
      createdBy: user?.uid ?? 'unknown',
      participantIds: data.participantIds ?? [],
    });

    const ref = await addDoc(this.col, {
      ...data,
      teamId: access.teamId,
      participantIds: access.participantIds,
      status: 'draft',
      turnOrderIndex: 0,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      createdBy: access.createdBy,
      createdByName: user?.displayName ?? user?.email ?? 'Unknown',
      totalStoryPoints: data.summary.totalStoryPoints,
      issueCount: data.tasks.length,
    });
    return ref.id;
  }

  async updateDraft(
    sessionId: string,
    payload: {
      teamId?: string;
      participantIds?: string[];
      tasks: TaskPlacement[];
      summary: PlanningSummary;
      guidedModeEnabled: boolean;
      turnOrderIndex: number;
      workflowStep: PlanningStep;
    },
  ): Promise<void> {
    const ref = doc(this.col, sessionId);
    await updateDoc(ref, {
      ...buildPlanningSessionMetadataPatch({
        teamId: payload.teamId,
        participantIds: payload.participantIds,
      }),
      tasks: payload.tasks,
      summary: payload.summary,
      guidedModeEnabled: payload.guidedModeEnabled,
      turnOrderIndex: payload.turnOrderIndex,
      workflowStep: payload.workflowStep,
      updatedAt: Timestamp.now(),
      totalStoryPoints: payload.summary.totalStoryPoints,
      issueCount: payload.tasks.length,
    });
  }

  async completePlanning(
    sessionId: string,
    tasks: TaskPlacement[],
    summary: PlanningSummary,
    workflowStep: PlanningStep = 'review-sprint',
    metadata?: {
      teamId?: string;
      participantIds?: string[];
    },
  ): Promise<void> {
    const ref = doc(this.col, sessionId);
    await updateDoc(ref, {
      ...buildPlanningSessionMetadataPatch(metadata ?? {}),
      tasks,
      summary,
      workflowStep,
      status: 'completed',
      updatedAt: Timestamp.now(),
      completedAt: Timestamp.now(),
      totalStoryPoints: summary.totalStoryPoints,
      issueCount: tasks.length,
    });
  }

  async getActiveDraftForSprint(
    sprintName: string,
  ): Promise<PlanningSession | null>;
  async getActiveDraftForSprint(
    teamId: string,
    sprintName: string,
  ): Promise<PlanningSession | null>;
  async getActiveDraftForSprint(
    teamIdOrSprintName: string,
    sprintName?: string,
  ): Promise<PlanningSession | null> {
    return this.getLatestSession(
      sprintName ? teamIdOrSprintName : null,
      sprintName ?? teamIdOrSprintName,
      'draft',
    );
  }

  async getCompletedForSprint(
    sprintName: string,
  ): Promise<PlanningSession | null>;
  async getCompletedForSprint(
    teamId: string,
    sprintName: string,
  ): Promise<PlanningSession | null>;
  async getCompletedForSprint(
    teamIdOrSprintName: string,
    sprintName?: string,
  ): Promise<PlanningSession | null> {
    return this.getLatestSession(
      sprintName ? teamIdOrSprintName : null,
      sprintName ?? teamIdOrSprintName,
      'completed',
    );
  }

  async getSessionById(id: string): Promise<PlanningSession | null> {
    const ref = doc(this.col, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as PlanningSession;
  }

  async getSessions(): Promise<PlanningSession[]> {
    const q = query(this.col, orderBy('updatedAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PlanningSession);
  }

  async getSessionsForTeam(teamId: string): Promise<PlanningSession[]> {
    const [scoped, legacy] = await Promise.all([
      teamId
        ? this.getSessionsByConstraints([
            where('teamId', '==', teamId),
            orderBy('updatedAt', 'desc'),
          ])
        : Promise.resolve([]),
      this.getLegacySessionsForCurrentUser(),
    ]);

    return mergePlanningSessions(scoped, legacy);
  }

  private async getLatestSession(
    teamId: string | null,
    sprintName: string,
    status: PlanningSession['status'],
  ): Promise<PlanningSession | null> {
    const scoped = teamId
      ? await this.getFirstSessionByConstraints([
          where('teamId', '==', teamId),
          where('sprintName', '==', sprintName),
          where('status', '==', status),
          orderBy('createdAt', 'desc'),
        ])
      : null;

    if (scoped) {
      return scoped;
    }

    return this.getLegacySessionForSprint(sprintName, status);
  }

  private async getLegacySessionForSprint(
    sprintName: string,
    status: PlanningSession['status'],
  ): Promise<PlanningSession | null> {
    const uid = this.auth.currentUser?.uid;
    if (!uid) return null;

    const sessions = await this.getSessionsByConstraints([
      where('createdBy', '==', uid),
      where('sprintName', '==', sprintName),
      where('status', '==', status),
      orderBy('createdAt', 'desc'),
    ]);

    return (
      sessions.find((session) => canReadLegacyPlanningSession(session, uid)) ?? null
    );
  }

  private async getLegacySessionsForCurrentUser(): Promise<PlanningSession[]> {
    const uid = this.auth.currentUser?.uid;
    if (!uid) return [];

    const sessions = await this.getSessionsByConstraints([
      where('createdBy', '==', uid),
      orderBy('updatedAt', 'desc'),
    ]);

    return sessions.filter((session) => canReadLegacyPlanningSession(session, uid));
  }

  private async getFirstSessionByConstraints(
    constraints: QueryConstraint[],
  ): Promise<PlanningSession | null> {
    const snap = await getDocs(query(this.col, ...constraints));
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id: d.id, ...d.data() } as PlanningSession;
  }

  private async getSessionsByConstraints(
    constraints: QueryConstraint[],
  ): Promise<PlanningSession[]> {
    const snap = await getDocs(query(this.col, ...constraints));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PlanningSession);
  }

  // ─── v2 session management ────────────────────────────────────────────────

  /**
   * Returns a live Observable that emits the session document whenever it
   * changes in Firestore. All session participants subscribe to this to keep
   * their view in sync with the facilitator's actions.
   */
  liveSessionV2$(sessionId: string): Observable<PlanningSessionV2 | null> {
    const ref = doc(this.col, sessionId);
    return docObservable<PlanningSessionV2>(ref);
  }

  /** Creates a new v2 planning session and returns its Firestore document ID. */
  async createSessionV2(payload: CreateSessionV2Payload): Promise<string> {
    const user = this.auth.currentUser;
    const teamId = user?.teamId?.trim();
    if (!teamId) throw new Error('Planning sessions require a teamId.');

    const access = buildPlanningSessionAccessFields({
      teamId,
      createdBy: user?.uid ?? 'unknown',
      participantIds: payload.participantIds,
    });

    const now = Timestamp.now();
    const session: Omit<PlanningSessionV2, 'id'> = {
      schemaVersion: 2,
      sprintId: payload.sprintId,
      sprintName: payload.sprintName,
      sprintGoal: payload.sprintGoal,
      sprintStartDate: payload.sprintStartDate,
      sprintEndDate: payload.sprintEndDate,
      teamId: access.teamId,
      status: 'draft',
      phase: 'setup',
      currentReviewIndex: 0,
      facilitatorId: user?.uid ?? 'unknown',
      facilitatorName: user?.displayName ?? user?.email ?? 'Unknown',
      participantIds: access.participantIds,
      participantNames: payload.participantNames,
      issueReviews: payload.issueReviews,
      issueParticipation: {},
      readinessWarnings: [],
      capacityData: [],
      summary: computeSessionSummary(payload.issueReviews),
      createdBy: access.createdBy,
      createdByName: user?.displayName ?? user?.email ?? 'Unknown',
      createdAt: now,
      updatedAt: now,
    };

    const ref = await addDoc(this.col, session);
    return ref.id;
  }

  /**
   * Reads a v2 session by ID. Returns null when the document does not exist
   * or is not a v2 session.
   */
  async getSessionV2ById(id: string): Promise<PlanningSessionV2 | null> {
    const ref = doc(this.col, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data: Record<string, unknown> = { id: snap.id, ...snap.data() };
    if (!isPlanningSessionV2(data)) return null;
    return data as PlanningSessionV2;
  }

  /**
   * Facilitator-only. Advances the session to the given phase.
   * Additional fields (e.g. readinessWarnings) can be merged atomically.
   */
  async advancePhase(
    sessionId: string,
    phase: PlanningPhase,
    extraFields: Record<string, unknown> = {},
  ): Promise<void> {
    const ref = doc(this.col, sessionId);
    await updateDoc(ref, { phase, updatedAt: Timestamp.now(), ...extraFields });
  }

  /** Facilitator-only. Moves the active review index to the given issue position. */
  async setReviewIndex(sessionId: string, index: number): Promise<void> {
    const ref = doc(this.col, sessionId);
    await updateDoc(ref, { currentReviewIndex: index, updatedAt: Timestamp.now() });
  }

  /**
   * Replaces the full issueReviews array and recomputes the summary.
   * Used by the facilitator to persist outcome and notes for reviewed issues.
   */
  async updateIssueReviews(
    sessionId: string,
    issueReviews: IssueReview[],
  ): Promise<void> {
    const ref = doc(this.col, sessionId);
    await updateDoc(ref, {
      issueReviews,
      summary: computeSessionSummary(issueReviews),
      updatedAt: Timestamp.now(),
    });
  }

  /**
   * Participant-only. Atomically adds the given UID to the participation list
   * for an issue, using Firestore `arrayUnion` so concurrent writes are safe.
   */
  async markParticipantWeighed(
    sessionId: string,
    issueId: string,
    uid: string,
  ): Promise<void> {
    const ref = doc(this.col, sessionId);
    await updateDoc(ref, {
      [`issueParticipation.${issueId}`]: arrayUnion(uid),
      updatedAt: Timestamp.now(),
    });
  }

  /** Persists the capacity calculation produced during Phase 5. */
  async updateCapacityAndSummary(
    sessionId: string,
    capacityData: CapacityEntry[],
    summary: PlanningSessionSummary,
  ): Promise<void> {
    const ref = doc(this.col, sessionId);
    await updateDoc(ref, { capacityData, summary, updatedAt: Timestamp.now() });
  }

  /**
   * Facilitator-only. Marks the session as completed and the phase as
   * 'finalized'. This is the terminal write for a v2 session.
   */
  async finalizeSessionV2(
    sessionId: string,
    issueReviews: IssueReview[],
    capacityData: CapacityEntry[],
  ): Promise<void> {
    const ref = doc(this.col, sessionId);
    const now = Timestamp.now();
    await updateDoc(ref, {
      status: 'completed',
      phase: 'finalized' as PlanningPhase,
      issueReviews,
      capacityData,
      summary: computeSessionSummary(issueReviews),
      updatedAt: now,
      completedAt: now,
    });
  }
}
