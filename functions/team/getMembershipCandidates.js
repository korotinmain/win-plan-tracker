class TeamMembershipCandidatesError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSearch(value) {
  return normalizeString(value).toLowerCase();
}

function normalizeStringArray(value) {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === "string" && item.trim())
    : [];
}

function normalizeUser(user) {
  if (!user) {
    return null;
  }

  const uid = normalizeString(user.uid);
  if (!uid) {
    return null;
  }

  return {
    uid,
    displayName: normalizeString(user.displayName),
    email: normalizeString(user.email),
    photoURL: normalizeString(user.photoURL),
    // Legacy docs should be backfilled to teamId: "" by the admin utility,
    // but helper normalization keeps pre-migration objects safe in tests.
    teamId: normalizeString(user.teamId),
  };
}

function mapTeamMembershipCandidate(user) {
  return {
    uid: user.uid,
    displayName: user.displayName,
    email: user.email,
    photoURL: user.photoURL,
    teamId: user.teamId,
  };
}

function ensureTeamMembershipCandidateAccess(team, callerUid) {
  const normalizedCallerUid = normalizeString(callerUid);
  if (!normalizedCallerUid) {
    throw new TeamMembershipCandidatesError(
      "unauthenticated",
      "The function must be called while authenticated.",
    );
  }

  const teamId = normalizeString(team?.id);
  if (!teamId) {
    throw new TeamMembershipCandidatesError(
      "invalid-argument",
      "team.id is required.",
    );
  }

  if (normalizeString(team?.managerId) !== normalizedCallerUid) {
    throw new TeamMembershipCandidatesError(
      "permission-denied",
      "Only the current team manager may list membership candidates.",
    );
  }

  return teamId;
}

function resolveTeamMembershipCandidates({
  team,
  users,
  callerUid,
  search = "",
}) {
  const teamId = ensureTeamMembershipCandidateAccess(team, callerUid);

  const existingMemberIds = new Set(normalizeStringArray(team?.memberIds));
  const queryText = normalizeSearch(search);
  const normalizedUsers = Array.isArray(users)
    ? users.map(normalizeUser).filter(Boolean)
    : [];

  return normalizedUsers
    .filter((user) => {
      if (existingMemberIds.has(user.uid)) {
        return false;
      }

      if (user.teamId && user.teamId !== teamId) {
        return false;
      }

      if (!queryText) {
        return true;
      }

      return (
        normalizeSearch(user.displayName).includes(queryText) ||
        normalizeSearch(user.email).includes(queryText)
      );
    })
    .map(mapTeamMembershipCandidate);
}

async function loadTeamMembershipCandidateUsers(db, teamId) {
  const usersCollection = db.collection("users");
  const [unassignedSnap, sameTeamSnap] = await Promise.all([
    usersCollection.where("teamId", "==", "").get(),
    usersCollection.where("teamId", "==", teamId).get(),
  ]);

  const normalizedUsers = [];
  const seenUids = new Set();

  for (const snapshot of [unassignedSnap, sameTeamSnap]) {
    for (const docSnap of snapshot.docs || []) {
      const user = normalizeUser({
        ...docSnap.data(),
        uid: docSnap.id,
      });
      if (!user || seenUids.has(user.uid)) {
        continue;
      }

      seenUids.add(user.uid);
      normalizedUsers.push(user);
    }
  }

  return normalizedUsers;
}

function normalizeCallableError(error, HttpsErrorCtor) {
  if (HttpsErrorCtor && error instanceof HttpsErrorCtor) {
    return error;
  }

  if (error instanceof TeamMembershipCandidatesError) {
    return new HttpsErrorCtor(error.code, error.message);
  }

  return new HttpsErrorCtor(
    "unknown",
    error?.message || "Unknown candidate lookup failure.",
  );
}

function createGetTeamMembershipCandidatesCallable() {
  const functions = require("firebase-functions");
  const admin = require("firebase-admin");
  const { ensureAuthenticated } = require("../shared/auth");

  return functions.https.onCall(async (data, context) => {
    let auth;
    try {
      auth = ensureAuthenticated(context);
    } catch (error) {
      throw normalizeCallableError(error, functions.https.HttpsError);
    }

    const teamId = normalizeString(data?.teamId);
    if (!teamId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "teamId is required.",
      );
    }

    const search = normalizeString(data?.search);

    try {
      const db = admin.firestore();
      const teamSnap = await db.doc(`teams/${teamId}`).get();

      if (!teamSnap.exists) {
        throw new TeamMembershipCandidatesError("not-found", "Team not found.");
      }

      ensureTeamMembershipCandidateAccess(
        {
          id: teamSnap.id,
          ...teamSnap.data(),
        },
        auth.uid,
      );

      const users = await loadTeamMembershipCandidateUsers(db, teamId);

      return {
        candidates: resolveTeamMembershipCandidates({
          team: {
            id: teamSnap.id,
            ...teamSnap.data(),
          },
          users,
          callerUid: auth.uid,
          search,
        }),
      };
    } catch (error) {
      throw normalizeCallableError(error, functions.https.HttpsError);
    }
  });
}

module.exports = {
  TeamMembershipCandidatesError,
  createGetTeamMembershipCandidatesCallable,
  ensureTeamMembershipCandidateAccess,
  loadTeamMembershipCandidateUsers,
  mapTeamMembershipCandidate,
  normalizeCallableError,
  resolveTeamMembershipCandidates,
};
