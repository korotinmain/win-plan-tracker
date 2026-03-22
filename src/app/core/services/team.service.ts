import { Injectable, inject } from '@angular/core';
import {
  collection,
  doc,
  runTransaction,
  setDoc,
  updateDoc,
  getDoc,
  getDocs,
  deleteField,
  query,
  where,
} from '@firebase/firestore';
import { Observable, combineLatest, map, of } from 'rxjs';
import { Team, SprintCeremonyConfig } from '../models/team.model';
import { TeamMember } from '../models/team-member.model';
import { AppUser } from '../models/user.model';
import { db } from '../../firebase';
import { docObservable, snapObservable } from '../../shared/utils/firestore.util';
import { TeamDirectoryService } from './team-directory.service';

export interface MembershipMutationPlan {
  teamMemberIds: string[];
  updateTeam: boolean;
  updateUserTeamId?: string;
}

export function resolveAddMemberMutation(
  team: Team,
  teamId: string,
  user: AppUser,
): MembershipMutationPlan {
  const teamMemberIds = team.memberIds ?? [];
  const inTeam = teamMemberIds.includes(user.uid);

  if (user.teamId && user.teamId !== teamId) {
    throw new Error('This member is already on a team. Leave it first.');
  }

  if (user.teamId === teamId) {
    if (inTeam) {
      throw new Error('This member is already on the team.');
    }
    return {
      teamMemberIds: [...teamMemberIds, user.uid],
      updateTeam: true,
    };
  }

  if (inTeam) {
    return {
      teamMemberIds,
      updateTeam: false,
      updateUserTeamId: teamId,
    };
  }

  return {
    teamMemberIds: [...teamMemberIds, user.uid],
    updateTeam: true,
    updateUserTeamId: teamId,
  };
}

export function resolveJoinTeamMutation(
  team: Team,
  teamId: string,
  user: AppUser,
): MembershipMutationPlan {
  const teamMemberIds = team.memberIds ?? [];
  const inTeam = teamMemberIds.includes(user.uid);

  if (user.teamId) {
    throw new Error('You are already a member of a team. Leave it first.');
  }

  if (inTeam) {
    return {
      teamMemberIds,
      updateTeam: false,
      updateUserTeamId: teamId,
    };
  }

  return {
    teamMemberIds: [...teamMemberIds, user.uid],
    updateTeam: true,
    updateUserTeamId: teamId,
  };
}

export function resolveRemoveMemberMutation(
  team: Team,
  teamId: string,
  user: AppUser,
): MembershipMutationPlan {
  const teamMemberIds = team.memberIds ?? [];
  const inTeam = teamMemberIds.includes(user.uid);

  if (user.teamId && user.teamId !== teamId) {
    throw new Error('This member belongs to another team.');
  }

  const nextTeamMemberIds = teamMemberIds.filter((id) => id !== user.uid);
  return {
    teamMemberIds: nextTeamMemberIds,
    updateTeam: inTeam,
    updateUserTeamId: user.teamId === teamId ? '' : undefined,
  };
}

@Injectable({ providedIn: 'root' })
export class TeamService {
  private readonly teamDirectoryService = inject(TeamDirectoryService);

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

  /**
   * Compatibility shim for legacy broad team-directory reads.
   * Prefer TeamDirectoryService.getDirectoryTeams() for intentional full-directory access.
   * Do not add new callers here.
   */
  getAllTeams(): Observable<Team[]> {
    return this.teamDirectoryService.getDirectoryTeams();
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

  /**
   * Compatibility shim for legacy broad user-directory reads.
   * Prefer TeamDirectoryService.getDirectoryUsers() for intentional full-directory access.
   * Do not add new callers here.
   */
  async getAllUsers(): Promise<AppUser[]> {
    return this.teamDirectoryService.getDirectoryUsers();
  }

  /** Fetch only specific users by UID — avoids a full collection scan. */
  async getMembersByIds(memberIds: string[]): Promise<AppUser[]> {
    if (!memberIds.length) return [];
    const chunks: string[][] = [];
    for (let i = 0; i < memberIds.length; i += 30) {
      chunks.push(memberIds.slice(i, i + 30));
    }
    const results = await Promise.all(
      chunks.map((chunk) =>
        getDocs(query(collection(db, 'users'), where('uid', 'in', chunk))).then(
          (snap) => snap.docs.map((d) => d.data() as AppUser),
        ),
      ),
    );
    return results.flat();
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
    await runTransaction(db, async (transaction) => {
      const teamRef = doc(db, `teams/${teamId}`);
      const userRef = doc(db, `users/${userId}`);

      const teamSnap = await transaction.get(teamRef);
      if (!teamSnap.exists()) {
        throw new Error('Team not found.');
      }

      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) {
        throw new Error('User not found.');
      }

      const team = teamSnap.data() as Team;
      const user = userSnap.data() as AppUser;
      const mutation = resolveAddMemberMutation(team, teamId, user);
      if (mutation.updateTeam) {
        transaction.update(teamRef, { memberIds: mutation.teamMemberIds });
      }
      if (mutation.updateUserTeamId !== undefined) {
        transaction.update(userRef, { teamId: mutation.updateUserTeamId });
      }
    });
  }

  async joinTeam(
    teamId: string,
    userId: string,
    currentMemberIds: string[],
  ): Promise<void> {
    await runTransaction(db, async (transaction) => {
      const teamRef = doc(db, `teams/${teamId}`);
      const userRef = doc(db, `users/${userId}`);

      const teamSnap = await transaction.get(teamRef);
      if (!teamSnap.exists()) {
        throw new Error('Team not found.');
      }

      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) {
        throw new Error('User not found.');
      }

      const team = teamSnap.data() as Team;
      const user = userSnap.data() as AppUser;
      const mutation = resolveJoinTeamMutation(team, teamId, user);
      if (mutation.updateTeam) {
        transaction.update(teamRef, { memberIds: mutation.teamMemberIds });
      }
      if (mutation.updateUserTeamId !== undefined) {
        transaction.update(userRef, { teamId: mutation.updateUserTeamId });
      }
    });
  }

  async removeMember(
    teamId: string,
    userId: string,
    currentMemberIds: string[],
  ): Promise<void> {
    await runTransaction(db, async (transaction) => {
      const teamRef = doc(db, `teams/${teamId}`);
      const userRef = doc(db, `users/${userId}`);

      const teamSnap = await transaction.get(teamRef);
      if (!teamSnap.exists()) {
        throw new Error('Team not found.');
      }

      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) {
        throw new Error('User not found.');
      }

      const team = teamSnap.data() as Team;
      const user = userSnap.data() as AppUser;
      const mutation = resolveRemoveMemberMutation(team, teamId, user);
      if (mutation.updateTeam) {
        transaction.update(teamRef, { memberIds: mutation.teamMemberIds });
      }
      if (mutation.updateUserTeamId !== undefined) {
        transaction.update(userRef, { teamId: mutation.updateUserTeamId });
      }
    });
  }

  async getTeam(teamId: string): Promise<Team | null> {
    if (!teamId) return null;
    const snap = await getDoc(doc(db, `teams/${teamId}`));
    return snap.exists() ? (snap.data() as Team) : null;
  }

  watchTeam(teamId: string): Observable<Team | null> {
    if (!teamId) return of(null);
    return docObservable<Team>(doc(db, `teams/${teamId}`));
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
