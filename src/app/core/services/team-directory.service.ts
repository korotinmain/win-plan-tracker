import { Injectable } from '@angular/core';
import { collection, getDocs, query } from '@firebase/firestore';
import { Observable } from 'rxjs';
import { db } from '../../firebase';
import { Team } from '../models/team.model';
import { AppUser } from '../models/user.model';
import { snapObservable } from '../../shared/utils/firestore.util';

const normalizeDirectoryText = (value?: string): string =>
  (value ?? '').toLowerCase();

@Injectable({ providedIn: 'root' })
export class TeamDirectoryService {
  getDirectoryTeams(): Observable<Team[]> {
    return snapObservable<Team>(query(collection(db, 'teams')));
  }

  async getDirectoryUsers(): Promise<AppUser[]> {
    const snap = await getDocs(collection(db, 'users'));
    return snap.docs.map((docSnapshot) => docSnapshot.data() as AppUser);
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
