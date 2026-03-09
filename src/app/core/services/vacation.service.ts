import { Injectable } from '@angular/core';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  Query,
  DocumentData,
} from '@firebase/firestore';
import { Observable } from 'rxjs';
import { VacationRequest } from '../models/vacation-request.model';
import { db } from '../../firebase';

function snapObservable<T>(q: Query<DocumentData>): Observable<T[]> {
  return new Observable<T[]>((subscriber) => {
    const unsub = onSnapshot(
      q,
      (snap) =>
        subscriber.next(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T)),
      (err) => subscriber.error(err),
    );
    return unsub;
  });
}

@Injectable({ providedIn: 'root' })
export class VacationService {
  /** All pending requests for a manager's team */
  getPendingRequests(teamId: string): Observable<VacationRequest[]> {
    const q = query(
      collection(db, 'vacationRequests'),
      where('teamId', '==', teamId),
      where('status', '==', 'pending'),
    );
    return snapObservable<VacationRequest>(q);
  }

  /** All requests for a specific employee */
  getUserRequests(userId: string): Observable<VacationRequest[]> {
    const q = query(
      collection(db, 'vacationRequests'),
      where('userId', '==', userId),
    );
    return snapObservable<VacationRequest>(q);
  }

  async submitRequest(request: Omit<VacationRequest, 'id'>): Promise<void> {
    const ref = doc(collection(db, 'vacationRequests'));
    await setDoc(ref, { ...request, id: ref.id });
  }

  async approveRequest(id: string, resolvedBy: string): Promise<void> {
    await updateDoc(doc(db, `vacationRequests/${id}`), {
      status: 'approved',
      resolvedBy,
      resolvedAt: new Date(),
    });
  }

  async rejectRequest(
    id: string,
    resolvedBy: string,
    rejectReason: string,
  ): Promise<void> {
    await updateDoc(doc(db, `vacationRequests/${id}`), {
      status: 'rejected',
      resolvedBy,
      resolvedAt: new Date(),
      rejectReason,
    });
  }
}
