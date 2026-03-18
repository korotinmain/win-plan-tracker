import { Injectable, inject } from '@angular/core';
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  Timestamp,
} from '@firebase/firestore';
import { db } from '../../firebase';
import { AuthService } from './auth.service';

export interface PlanningSession {
  id?: string;
  sprintId: number;
  sprintName: string;
  createdAt: Timestamp;
  participants: string[];
  totalStoryPoints: number;
  issueCount: number;
  createdBy: string;
  createdByName: string;
}

@Injectable({ providedIn: 'root' })
export class PlanningService {
  private auth = inject(AuthService);
  private col = collection(db, 'planningSessions');

  async saveSession(
    session: Omit<
      PlanningSession,
      'id' | 'createdAt' | 'createdBy' | 'createdByName'
    >,
  ): Promise<string> {
    const user = this.auth.currentUser;
    const ref = await addDoc(this.col, {
      ...session,
      createdAt: Timestamp.now(),
      createdBy: user?.uid ?? 'unknown',
      createdByName: user?.displayName ?? user?.email ?? 'Unknown',
    });
    return ref.id;
  }

  async getSessions(): Promise<PlanningSession[]> {
    const q = query(this.col, orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PlanningSession);
  }
}
