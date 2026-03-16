import { Injectable } from '@angular/core';
import {
  collection,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  writeBatch,
} from '@firebase/firestore';
import { Observable } from 'rxjs';
import {
  AppNotification,
  NotificationEventType,
} from '../models/notification.model';
import { AppUser } from '../models/user.model';
import { db } from '../../firebase';
import { snapObservable } from '../../shared/utils/firestore.util';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  /** Real-time stream of the latest 50 notifications for a user. */
  getNotifications(uid: string): Observable<AppNotification[]> {
    const q = query(
      collection(db, 'notifications'),
      where('recipientUid', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(50),
    );
    return snapObservable<AppNotification>(q);
  }

  async markAsRead(id: string): Promise<void> {
    await updateDoc(doc(db, `notifications/${id}`), { read: true });
  }

  async markAllAsRead(notifications: AppNotification[]): Promise<void> {
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;
    const batch = writeBatch(db);
    for (const n of unread) {
      batch.update(doc(db, `notifications/${n.id}`), { read: true });
    }
    await batch.commit();
  }

  /**
   * Fan-out: create one notification document per teammate (excluding the actor).
   * Called immediately after vacation / day-off events are saved to Firestore.
   */
  async createForTeam(
    actor: AppUser,
    teamId: string,
    type: NotificationEventType,
    startDate: string,
    endDate: string | undefined,
    note: string | undefined,
    teammates: AppUser[],
  ): Promise<void> {
    const batch = writeBatch(db);
    for (const member of teammates) {
      if (member.uid === actor.uid) continue;
      const ref = doc(collection(db, 'notifications'));
      const payload: Record<string, unknown> = {
        id: ref.id,
        recipientUid: member.uid,
        actorUid: actor.uid,
        actorName: actor.displayName,
        teamId,
        type,
        startDate,
        read: false,
        createdAt: new Date(),
      };
      if (actor.photoURL) payload['actorPhotoURL'] = actor.photoURL;
      if (endDate) payload['endDate'] = endDate;
      if (note) payload['note'] = note;
      batch.set(ref, payload);
    }
    await batch.commit();
  }
}
