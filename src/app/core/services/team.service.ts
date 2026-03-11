import { Injectable } from '@angular/core';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  getDocs,
  deleteField,
  query,
  where,
  onSnapshot,
  Query,
  DocumentData,
} from '@firebase/firestore';
import { Observable, combineLatest, map } from 'rxjs';
import { Team, SprintCeremonyConfig } from '../models/team.model';
import { TeamMember } from '../models/team-member.model';
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

  async getTeam(teamId: string): Promise<Team | null> {
    if (!teamId) return null;
    const snap = await getDoc(doc(db, `teams/${teamId}`));
    return snap.exists() ? (snap.data() as Team) : null;
  }

  async updateHolidayCountry(
    teamId: string,
    countryCode: string,
  ): Promise<void> {
    await updateDoc(doc(db, `teams/${teamId}`), {
      holidayCountryCode: countryCode || deleteField(),
    });
  }

  async updateCeremonyConfig(
    teamId: string,
    config: SprintCeremonyConfig,
  ): Promise<void> {
    await updateDoc(doc(db, `teams/${teamId}`), { ceremonyConfig: config });
  }

  /** Real-time listener on teams/{teamId}/members subcollection. */
  getTeamMembersEnrichments(teamId: string): Observable<TeamMember[]> {
    return snapObservable<TeamMember>(
      query(collection(db, `teams/${teamId}/members`)),
    );
  }

  /** Create or merge-update a member enrichment document. */
  async saveTeamMemberEnrichment(
    teamId: string,
    memberId: string,
    data: Omit<TeamMember, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<void> {
    await setDoc(
      doc(db, `teams/${teamId}/members/${memberId}`),
      { ...data, id: memberId, createdAt: new Date(), updatedAt: new Date() },
      { merge: true },
    );
  }

  /** Partial update of a member enrichment document. */
  async updateTeamMemberEnrichment(
    teamId: string,
    memberId: string,
    data: Partial<Omit<TeamMember, 'id' | 'createdAt'>>,
  ): Promise<void> {
    try {
      await updateDoc(doc(db, `teams/${teamId}/members/${memberId}`), {
        ...data,
        updatedAt: new Date(),
      });
    } catch {
      // Doc may not exist yet — fall back to setDoc
      await setDoc(
        doc(db, `teams/${teamId}/members/${memberId}`),
        { ...data, id: memberId, createdAt: new Date(), updatedAt: new Date() },
        { merge: true },
      );
    }
  }

  /** Remove member from team memberIds list and mark enrichment as inactive. */
  async removeTeamMember(
    teamId: string,
    userId: string,
    currentMemberIds: string[],
  ): Promise<void> {
    await this.removeMember(teamId, userId, currentMemberIds);
    try {
      await updateDoc(doc(db, `teams/${teamId}/members/${userId}`), {
        isActive: false,
        updatedAt: new Date(),
      });
    } catch {
      // Enrichment doc may not exist — no-op
    }
  }
}
