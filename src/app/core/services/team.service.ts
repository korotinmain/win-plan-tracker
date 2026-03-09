import { Injectable } from '@angular/core';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  Query,
  DocumentData,
} from '@firebase/firestore';
import { Observable } from 'rxjs';
import { Team } from '../models/team.model';
import { AppUser } from '../models/user.model';
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
export class TeamService {
  getTeamsByCompany(companyId: string): Observable<Team[]> {
    const q = query(
      collection(db, 'teams'),
      where('companyId', '==', companyId),
    );
    return snapObservable<Team>(q);
  }

  async createTeam(team: Omit<Team, 'id'>): Promise<string> {
    const ref = doc(collection(db, 'teams'));
    await setDoc(ref, { ...team, id: ref.id });
    return ref.id;
  }

  async getCompanyUsers(companyId: string): Promise<AppUser[]> {
    if (!companyId) return [];
    const q = query(
      collection(db, 'users'),
      where('companyId', '==', companyId),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as AppUser);
  }

  async getTeamMembers(teamId: string): Promise<AppUser[]> {
    if (!teamId) return [];
    const snap = await getDoc(doc(db, `teams/${teamId}`));
    if (!snap.exists()) return [];
    const team = snap.data() as Team;
    const members = await Promise.all(
      team.memberIds.map(async (uid) => {
        const userSnap = await getDoc(doc(db, `users/${uid}`));
        return userSnap.data() as AppUser;
      }),
    );
    return members.filter(Boolean);
  }

  async addMember(
    teamId: string,
    userId: string,
    currentMemberIds: string[],
  ): Promise<void> {
    const updated = Array.from(new Set([...currentMemberIds, userId]));
    await updateDoc(doc(db, `teams/${teamId}`), { memberIds: updated });
    await updateDoc(doc(db, `users/${userId}`), { teamId });
  }

  async removeMember(
    teamId: string,
    userId: string,
    currentMemberIds: string[],
  ): Promise<void> {
    const updated = currentMemberIds.filter((id) => id !== userId);
    await updateDoc(doc(db, `teams/${teamId}`), { memberIds: updated });
    await updateDoc(doc(db, `users/${userId}`), { teamId: '' });
  }
}
