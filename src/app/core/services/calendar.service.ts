import { Injectable } from '@angular/core';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  Query,
  DocumentData,
} from '@firebase/firestore';
import { Observable } from 'rxjs';
import { CalendarEvent, Holiday } from '../models/event.model';
import { format, startOfMonth, endOfMonth } from 'date-fns';
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
export class CalendarService {
  /** Stream all events for a team in a given month */
  getTeamEvents(
    teamId: string,
    year: number,
    month: number,
  ): Observable<CalendarEvent[]> {
    const start = format(startOfMonth(new Date(year, month - 1)), 'yyyy-MM-dd');
    const end = format(endOfMonth(new Date(year, month - 1)), 'yyyy-MM-dd');
    const q = query(
      collection(db, 'events'),
      where('teamId', '==', teamId),
      where('date', '>=', start),
      where('date', '<=', end),
    );
    return snapObservable<CalendarEvent>(q);
  }

  /** Set (add or overwrite) a single-day event */
  async setEvent(event: Omit<CalendarEvent, 'id'>): Promise<void> {
    const id = `${event.userId}_${event.date}`;
    await setDoc(doc(db, `events/${id}`), { ...event, id });
  }

  /** Remove a single-day event */
  async removeEvent(userId: string, date: string): Promise<void> {
    await deleteDoc(doc(db, `events/${userId}_${date}`));
  }

  /** Stream holidays for a company */
  getHolidays(companyId: string): Observable<Holiday[]> {
    const q = query(
      collection(db, 'holidays'),
      where('companyId', '==', companyId),
    );
    return snapObservable<Holiday>(q);
  }

  async addHoliday(holiday: Omit<Holiday, 'id'>): Promise<void> {
    const ref = doc(collection(db, 'holidays'));
    await setDoc(ref, { ...holiday, id: ref.id });
  }

  async deleteHoliday(id: string): Promise<void> {
    await deleteDoc(doc(db, `holidays/${id}`));
  }
}
