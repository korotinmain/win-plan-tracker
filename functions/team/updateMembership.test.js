const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { createRequire } = require("node:module");

const requireFromRepoRoot = createRequire(
  path.join(
    __dirname,
    "../node_modules/firebase-functions/package.json",
  ),
);
const functions = requireFromRepoRoot("firebase-functions");

const {
  resolveTeamMembershipMutation,
  normalizeCallableError,
} = require("./updateMembership");

test("join creates a fresh self-membership when no stale conflicts exist", () => {
  const plan = resolveTeamMembershipMutation({
    action: "join",
    teamId: "team-a",
    callerUid: "user-a",
    team: { id: "team-a", managerId: "manager-a", memberIds: [] },
    user: { uid: "user-a", teamId: "" },
    conflictingTeamIds: [],
  });

  assert.deepEqual(plan, {
    action: "join",
    teamId: "team-a",
    userId: "user-a",
    teamMemberIds: ["user-a"],
    userTeamId: "team-a",
    status: "updated",
  });
});

test("join rejects a stale membership that already exists on another team", () => {
  assert.throws(
    () =>
      resolveTeamMembershipMutation({
        action: "join",
        teamId: "team-b",
        callerUid: "user-a",
        team: { id: "team-b", managerId: "manager-b", memberIds: [] },
        user: { uid: "user-a", teamId: "" },
        conflictingTeamIds: ["team-a"],
      }),
    (error) => error.code === "failed-precondition",
  );
});

test("add requires the caller to manage the target team", () => {
  assert.throws(
    () =>
      resolveTeamMembershipMutation({
        action: "add",
        teamId: "team-a",
        callerUid: "manager-b",
        userId: "user-a",
        team: { id: "team-a", managerId: "manager-a", memberIds: [] },
        user: { uid: "user-a", teamId: "" },
        conflictingTeamIds: [],
      }),
    (error) => error.code === "permission-denied",
  );
});

test("add repairs same-team stale membership without reassigning the user", () => {
  const plan = resolveTeamMembershipMutation({
    action: "add",
    teamId: "team-a",
    callerUid: "manager-a",
    userId: "user-a",
    team: { id: "team-a", managerId: "manager-a", memberIds: [] },
    user: { uid: "user-a", teamId: "team-a" },
    conflictingTeamIds: [],
  });

  assert.deepEqual(plan, {
    action: "add",
    teamId: "team-a",
    userId: "user-a",
    teamMemberIds: ["user-a"],
    userTeamId: undefined,
    status: "updated",
  });
});

test("add allows same-team repair even when other teams still list the user", () => {
  const plan = resolveTeamMembershipMutation({
    action: "add",
    teamId: "team-a",
    callerUid: "manager-a",
    userId: "user-a",
    team: { id: "team-a", managerId: "manager-a", memberIds: [] },
    user: { uid: "user-a", teamId: "team-a" },
    conflictingTeamIds: ["team-b"],
  });

  assert.deepEqual(plan, {
    action: "add",
    teamId: "team-a",
    userId: "user-a",
    teamMemberIds: ["user-a"],
    userTeamId: undefined,
    status: "updated",
  });
});

test("remove allows safe stale cleanup when the user still points at another team", () => {
  const plan = resolveTeamMembershipMutation({
    action: "remove",
    teamId: "team-a",
    callerUid: "manager-a",
    userId: "user-a",
    team: { id: "team-a", managerId: "manager-a", memberIds: ["user-a"] },
    user: { uid: "user-a", teamId: "team-b" },
    conflictingTeamIds: [],
  });

  assert.deepEqual(plan, {
    action: "remove",
    teamId: "team-a",
    userId: "user-a",
    teamMemberIds: [],
    userTeamId: undefined,
    status: "updated",
  });
});

test("leave clears stale self-membership even when the team doc is missing the caller", () => {
  const plan = resolveTeamMembershipMutation({
    action: "leave",
    teamId: "team-a",
    callerUid: "user-a",
    team: { id: "team-a", managerId: "manager-a", memberIds: [] },
    user: { uid: "user-a", teamId: "team-a" },
    conflictingTeamIds: [],
  });

  assert.deepEqual(plan, {
    action: "leave",
    teamId: "team-a",
    userId: "user-a",
    teamMemberIds: [],
    userTeamId: "",
    status: "updated",
  });
});

test("normalizeCallableError preserves an existing unauthenticated HttpsError", () => {
  const existingError = new functions.https.HttpsError(
    "unauthenticated",
    "The function must be called while authenticated.",
  );

  assert.equal(
    normalizeCallableError(existingError, functions.https.HttpsError),
    existingError,
  );
});
