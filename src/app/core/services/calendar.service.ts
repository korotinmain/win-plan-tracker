import { Injectable } from '@angular/core';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  query,
  where,
} from '@firebase/firestore';
import { Observable } from 'rxjs';
import { CalendarEvent, Holiday } from '../models/event.model';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { db } from '../../firebase';
import { snapObservable } from '../../shared/utils/firestore.util';

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
    const data = Object.fromEntries(
      Object.entries({ ...event, id }).filter(([, v]) => v !== undefined),
    );
    await setDoc(doc(db, `events/${id}`), data);
  }

  /** Remove a single-day event */
  async removeEvent(userId: string, date: string): Promise<void> {
    await deleteDoc(doc(db, `events/${userId}_${date}`));
  }

  /** Stream holidays for a team */
  getHolidays(teamId: string): Observable<Holiday[]> {
    const q = query(collection(db, 'holidays'), where('teamId', '==', teamId));
    return snapObservable<Holiday>(q);
  }

  async addHoliday(holiday: Omit<Holiday, 'id'>): Promise<void> {
    const ref = doc(collection(db, 'holidays'));
    await setDoc(ref, { ...holiday, id: ref.id });
  }

  async deleteHoliday(id: string): Promise<void> {
    await deleteDoc(doc(db, `holidays/${id}`));
  }

  /** All events for a team across all time (no month filter) */
  getTeamAllEvents(teamId: string): Observable<CalendarEvent[]> {
    const q = query(collection(db, 'events'), where('teamId', '==', teamId));
    return snapObservable<CalendarEvent>(q);
  }
}
