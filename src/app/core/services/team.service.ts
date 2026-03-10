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
import { Observable, combineLatest, map } from 'rxjs';
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
  getTeamsForUser(uid: string): Observable<Team[]> {
    const managed = snapObservable<Team>(
      query(collection(db, 'teams'), where('managerId', '==', uid)),
    );
    const member = snapObservable<Team>(
      query(collection(db, 'teams'), where('memberIds', 'array-contains', uid)),
    );
    return combineLatest([managed, member]).pipe(
      map(([a, b]) => {
        const seen = new Set<string>();
        return [...a, ...b].filter((t) => {
          if (seen.has(t.id)) return false;
          seen.add(t.id);
          return true;
        });
      }),
    );
  }

  getAllTeams(): Observable<Team[]> {
    return snapObservable<Team>(query(collection(db, 'teams')));
  }

  async createTeam(team: Omit<Team, 'id'>): Promise<string> {
    const iconCheck = await getDocs(
      query(collection(db, 'teams'), where('icon', '==', team.icon)),
    );
    if (!iconCheck.empty) {
      throw new Error(
        'This icon is already used by another team. Please choose a different one.',
      );
    }
    const ref = doc(collection(db, 'teams'));
    await setDoc(ref, { ...team, id: ref.id });
    return ref.id;
  }

  async getAllUsers(): Promise<AppUser[]> {
    const snap = await getDocs(collection(db, 'users'));
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

  async joinTeam(
    teamId: string,
    userId: string,
    currentMemberIds: string[],
  ): Promise<void> {
    const userSnap = await getDoc(doc(db, `users/${userId}`));
    const existingTeamId = userSnap.exists()
      ? (userSnap.data() as any)?.teamId
      : null;
    if (existingTeamId) {
      throw new Error('You are already a member of a team. Leave it first.');
    }
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
