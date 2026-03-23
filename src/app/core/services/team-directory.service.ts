import { Injectable, inject } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { collection, getDocs, query } from '@firebase/firestore';
import { Observable } from 'rxjs';
import { db } from '../../firebase';
import { Team } from '../models/team.model';
import { AppUser } from '../models/user.model';
import { snapObservable } from '../../shared/utils/firestore.util';

const normalizeDirectoryText = (value?: string): string =>
  (value ?? '').toLowerCase();

export interface TeamMembershipCandidate {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  teamId: string;
}

interface GetTeamMembershipCandidatesRequest {
  teamId: string;
  search?: string;
}

interface GetTeamMembershipCandidatesResponse {
  candidates: TeamMembershipCandidate[];
}

export const teamMembershipCandidatesCallable = {
  getTeamMembershipCandidates(
    functions: Functions,
    payload: GetTeamMembershipCandidatesRequest,
  ): Promise<GetTeamMembershipCandidatesResponse> {
    const fn = httpsCallable<
      GetTeamMembershipCandidatesRequest,
      GetTeamMembershipCandidatesResponse
    >(functions, 'getTeamMembershipCandidates');
    return fn(payload).then((result) => result.data);
  },
};

@Injectable({ providedIn: 'root' })
export class TeamDirectoryService {
  private readonly functions = inject(Functions);

  getDirectoryTeams(): Observable<Team[]> {
    return snapObservable<Team>(query(collection(db, 'teams')));
  }

  async getDirectoryUsers(): Promise<AppUser[]> {
    const snap = await getDocs(collection(db, 'users'));
    return snap.docs.map((docSnapshot) => docSnapshot.data() as AppUser);
  }

  async getMembershipCandidates(
    teamId: string,
    search = '',
  ): Promise<TeamMembershipCandidate[]> {
    const payload: GetTeamMembershipCandidatesRequest = search.trim()
      ? { teamId, search: search.trim() }
      : { teamId };
    const result = await teamMembershipCandidatesCallable.getTeamMembershipCandidates(
      this.functions,
      payload,
    );
    return result.candidates.map((candidate) => ({
      uid: candidate.uid,
      displayName: candidate.displayName,
      email: candidate.email,
      photoURL: candidate.photoURL,
      teamId: candidate.teamId,
    }));
  }
}

export function filterCandidateUsers(
  users: AppUser[],
  existingMemberIds: readonly string[],
  search = '',
  currentTeamId = '',
): AppUser[] {
  const existingIds = new Set(existingMemberIds);
  const queryText = normalizeDirectoryText(search.trim());
  const normalizedTeamId = currentTeamId.trim();

  return users.filter((user) => {
    if (existingIds.has(user.uid)) {
      return false;
    }

    const userTeamId = (user.teamId ?? '').trim();
    if (userTeamId && userTeamId !== normalizedTeamId) {
      return false;
    }

    if (!queryText) {
      return true;
    }

    return (
      normalizeDirectoryText(user.displayName).includes(queryText) ||
      normalizeDirectoryText(user.email).includes(queryText)
    );
  });
}

export function filterJoinableTeams(
  teams: Team[],
  userId: string,
  search = '',
): Team[] {
  const queryText = normalizeDirectoryText(search.trim());

  return teams.filter((team) => {
    if (team.memberIds.includes(userId)) {
      return false;
    }

    if (!queryText) {
      return true;
    }

    return normalizeDirectoryText(team.name).includes(queryText);
  });
}
