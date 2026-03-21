import { Injectable, inject } from '@angular/core';
import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where,
} from '@firebase/firestore';
import { db } from '../../firebase';
import { AuthService } from './auth.service';

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
  participants: string[];
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
  participants: string[];
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
    const ref = await addDoc(this.col, {
      ...data,
      status: 'draft',
      turnOrderIndex: 0,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      createdBy: user?.uid ?? 'unknown',
      createdByName: user?.displayName ?? user?.email ?? 'Unknown',
      totalStoryPoints: data.summary.totalStoryPoints,
      issueCount: data.tasks.length,
    });
    return ref.id;
  }

  async updateDraft(
    sessionId: string,
    payload: {
      tasks: TaskPlacement[];
      summary: PlanningSummary;
      guidedModeEnabled: boolean;
      turnOrderIndex: number;
      workflowStep: PlanningStep;
    },
  ): Promise<void> {
    const ref = doc(this.col, sessionId);
    await updateDoc(ref, {
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
  ): Promise<void> {
    const ref = doc(this.col, sessionId);
    await updateDoc(ref, {
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
  ): Promise<PlanningSession | null> {
    const q = query(
      this.col,
      where('sprintName', '==', sprintName),
      where('status', '==', 'draft'),
      orderBy('createdAt', 'desc'),
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id: d.id, ...d.data() } as PlanningSession;
  }

  async getCompletedForSprint(
    sprintName: string,
  ): Promise<PlanningSession | null> {
    const q = query(
      this.col,
      where('sprintName', '==', sprintName),
      where('status', '==', 'completed'),
      orderBy('createdAt', 'desc'),
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id: d.id, ...d.data() } as PlanningSession;
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
}
