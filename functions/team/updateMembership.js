class MembershipError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStringArray(value) {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === "string" && item.trim())
    : [];
}

function arraysEqual(a, b) {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((item, index) => item === b[index]);
}

function normalizeAction(action) {
  return normalizeString(action).toLowerCase();
}

function getTargetUserId(action, callerUid, userId) {
  const normalizedUserId = normalizeString(userId);
  if (action === "join" || action === "leave") {
    if (normalizedUserId && normalizedUserId !== callerUid) {
      throw new MembershipError(
        "invalid-argument",
        "join and leave can only act on the caller.",
      );
    }
    return callerUid;
  }
  if (!normalizedUserId) {
    throw new MembershipError(
      "invalid-argument",
      "userId is required for add and remove.",
    );
  }
  return normalizedUserId;
}

function resolveTeamMembershipMutation({
  action,
  teamId,
  callerUid,
  userId,
  team,
  user,
  conflictingTeamIds = [],
}) {
  const normalizedAction = normalizeAction(action);
  if (!["add", "join", "remove", "leave"].includes(normalizedAction)) {
    throw new MembershipError(
      "invalid-argument",
      "action must be one of add, join, remove, leave.",
    );
  }

  const normalizedTeamId = normalizeString(teamId);
  if (!normalizedTeamId) {
    throw new MembershipError("invalid-argument", "teamId is required.");
  }

  const normalizedCallerUid = normalizeString(callerUid);
  if (!normalizedCallerUid) {
    throw new MembershipError(
      "unauthenticated",
      "The function must be called while authenticated.",
    );
  }

  const targetUserId = getTargetUserId(
    normalizedAction,
    normalizedCallerUid,
    userId,
  );
  const teamMemberIds = normalizeStringArray(team?.memberIds);
  const userTeamId = normalizeString(user?.teamId);
  const managerId = normalizeString(team?.managerId);
  const teamHasUser = teamMemberIds.includes(targetUserId);
  const userHasTargetTeam = userTeamId === normalizedTeamId;
  const otherTeamIds = [...new Set(normalizeStringArray(conflictingTeamIds))]
    .filter((id) => id !== normalizedTeamId);

  if (normalizedAction === "add" || normalizedAction === "remove") {
    if (managerId !== normalizedCallerUid) {
      throw new MembershipError(
        "permission-denied",
        "Only the team manager may add or remove members.",
      );
    }
  }

  if (normalizedAction === "add" || normalizedAction === "join") {
    if (userTeamId && userTeamId !== normalizedTeamId) {
      throw new MembershipError(
        "failed-precondition",
        "This user is already assigned to another team. Leave it first.",
      );
    }

    if (otherTeamIds.length > 0) {
      throw new MembershipError(
        "failed-precondition",
        "This user is already listed on another team. Clean up the stale membership first.",
      );
    }

    if (teamHasUser && userHasTargetTeam) {
      return {
        action: normalizedAction,
        teamId: normalizedTeamId,
        userId: targetUserId,
        teamMemberIds,
        userTeamId: undefined,
        status: "noop",
      };
    }

    return {
      action: normalizedAction,
      teamId: normalizedTeamId,
      userId: targetUserId,
      teamMemberIds: teamHasUser
        ? teamMemberIds
        : [...teamMemberIds, targetUserId],
      userTeamId: userHasTargetTeam ? undefined : normalizedTeamId,
      status: "updated",
    };
  }

  if (!teamHasUser && !userHasTargetTeam) {
    throw new MembershipError(
      "failed-precondition",
      "This user is not a member of this team.",
    );
  }

  return {
    action: normalizedAction,
    teamId: normalizedTeamId,
    userId: targetUserId,
    teamMemberIds: teamHasUser
      ? teamMemberIds.filter((memberId) => memberId !== targetUserId)
      : teamMemberIds,
    userTeamId: userHasTargetTeam ? "" : undefined,
    status: "updated",
  };
}

async function loadMembershipState(transaction, teamId, userId, action) {
  const admin = require("firebase-admin");
  const db = admin.firestore();
  const teamRef = db.doc(`teams/${teamId}`);
  const userRef = db.doc(`users/${userId}`);

  const reads = [transaction.get(teamRef), transaction.get(userRef)];
  let conflictQuerySnap = null;
  if (action === "add" || action === "join") {
    const conflictQuery = db
      .collection("teams")
      .where("memberIds", "array-contains", userId);
    reads.push(transaction.get(conflictQuery));
  }

  const [teamSnap, userSnap, maybeConflictSnap] = await Promise.all(reads);
  if (maybeConflictSnap) {
    conflictQuerySnap = maybeConflictSnap;
  }

  return {
    teamRef,
    userRef,
    teamSnap,
    userSnap,
    conflictingTeamIds: conflictQuerySnap
      ? conflictQuerySnap.docs.map((docSnap) => docSnap.id)
      : [],
  };
}

exports.resolveTeamMembershipMutation = resolveTeamMembershipMutation;
exports.createUpdateTeamMembershipCallable = createUpdateTeamMembershipCallable;

function createUpdateTeamMembershipCallable() {
  const functions = require("firebase-functions");
  const admin = require("firebase-admin");
  const { ensureAuthenticated } = require("../shared/auth");

  function toHttpsError(error) {
    if (error instanceof MembershipError) {
      return new functions.https.HttpsError(error.code, error.message);
    }
    return new functions.https.HttpsError(
      "unknown",
      error?.message || "Unknown membership mutation failure.",
    );
  }

  return functions.https.onCall(async (data, context) => {
    let auth;
    try {
      auth = ensureAuthenticated(context);
    } catch (error) {
      throw toHttpsError(error);
    }

    const action = normalizeAction(data?.action);
    const teamId = normalizeString(data?.teamId);
    if (!teamId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "teamId is required.",
      );
    }
    if (!["add", "join", "remove", "leave"].includes(action)) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "action must be one of add, join, remove, leave.",
      );
    }

    try {
      const targetUserId = getTargetUserId(action, auth.uid, data?.userId);

      return await admin.firestore().runTransaction(async (transaction) => {
        const {
          teamRef,
          userRef,
          teamSnap,
          userSnap,
          conflictingTeamIds,
        } = await loadMembershipState(
          transaction,
          teamId,
          targetUserId,
          action,
        );

        if (!teamSnap.exists) {
          throw new MembershipError("not-found", "Team not found.");
        }

        if (!userSnap.exists) {
          throw new MembershipError("not-found", "User not found.");
        }

        const plan = resolveTeamMembershipMutation({
          action,
          teamId,
          callerUid: auth.uid,
          userId: targetUserId,
          team: teamSnap.data(),
          user: userSnap.data(),
          conflictingTeamIds,
        });

        const currentTeamMemberIds = normalizeStringArray(
          teamSnap.data()?.memberIds,
        );
        if (!arraysEqual(currentTeamMemberIds, plan.teamMemberIds)) {
          transaction.update(teamRef, { memberIds: plan.teamMemberIds });
        }

        if (plan.userTeamId !== undefined) {
          transaction.update(userRef, { teamId: plan.userTeamId });
        }

        return {
          action: plan.action,
          teamId: plan.teamId,
          userId: plan.userId,
          status: plan.status,
        };
      });
    } catch (error) {
      throw toHttpsError(error);
    }
  });
}
