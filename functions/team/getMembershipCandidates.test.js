const test = require("node:test");
const assert = require("node:assert/strict");

const {
  loadTeamMembershipCandidateUsers,
  resolveTeamMembershipCandidates,
} = require("./getMembershipCandidates");

const baseTeam = {
  id: "team-a",
  managerId: "manager-a",
  memberIds: ["member-a"],
};

const baseUsers = [
  {
    uid: "candidate-a",
    displayName: "Alice Candidate",
    email: "alice@example.com",
    photoURL: "https://example.com/alice.png",
    teamId: "",
  },
  {
    uid: "member-a",
    displayName: "Morgan Member",
    email: "morgan@example.com",
    photoURL: "https://example.com/morgan.png",
    teamId: "team-a",
  },
  {
    uid: "repair-a",
    displayName: "Riley Repair",
    email: "riley@example.com",
    photoURL: "https://example.com/riley.png",
    teamId: "team-a",
  },
  {
    uid: "other-a",
    displayName: "Olivia Other",
    email: "olivia@example.com",
    photoURL: "https://example.com/olivia.png",
    teamId: "team-b",
  },
  {
    uid: "search-a",
    displayName: "Search Target",
    email: "needle@example.com",
    photoURL: "https://example.com/search.png",
    teamId: "",
  },
];

test("manager gets only join-eligible candidates for the target team", () => {
  const result = resolveTeamMembershipCandidates({
    team: baseTeam,
    users: baseUsers,
    callerUid: "manager-a",
  });

  assert.deepEqual(
    result.map((candidate) => candidate.uid),
    ["candidate-a", "repair-a", "search-a"],
  );
  assert.deepEqual(result[0], {
    uid: "candidate-a",
    displayName: "Alice Candidate",
    email: "alice@example.com",
    photoURL: "https://example.com/alice.png",
    teamId: "",
  });
});

test("non-manager caller is denied", () => {
  assert.throws(
    () =>
      resolveTeamMembershipCandidates({
        team: baseTeam,
        users: baseUsers,
        callerUid: "someone-else",
      }),
    (error) => error.code === "permission-denied",
  );
});

test("same-team repair candidates remain included", () => {
  const result = resolveTeamMembershipCandidates({
    team: {
      id: "team-a",
      managerId: "manager-a",
      memberIds: [],
    },
    users: [
      {
        uid: "repair-a",
        displayName: "Riley Repair",
        email: "riley@example.com",
        photoURL: "https://example.com/riley.png",
        teamId: "team-a",
      },
    ],
    callerUid: "manager-a",
  });

  assert.deepEqual(result.map((candidate) => candidate.uid), ["repair-a"]);
});

test("existing members and other-team users are excluded", () => {
  const result = resolveTeamMembershipCandidates({
    team: baseTeam,
    users: baseUsers,
    callerUid: "manager-a",
  });

  assert.equal(
    result.some((candidate) => candidate.uid === "member-a"),
    false,
  );
  assert.equal(
    result.some((candidate) => candidate.uid === "other-a"),
    false,
  );
});

test("search trims whitespace and matches displayName or email", () => {
  const result = resolveTeamMembershipCandidates({
    team: {
      id: "team-a",
      managerId: "manager-a",
      memberIds: [],
    },
    users: [
      {
        uid: "name-match",
        displayName: "Needle Finder",
        email: "not-used@example.com",
        photoURL: "",
        teamId: "",
      },
      {
        uid: "email-match",
        displayName: "No Match",
        email: "needle@example.com",
        photoURL: "",
        teamId: "",
      },
      {
        uid: "no-match",
        displayName: "Someone Else",
        email: "other@example.com",
        photoURL: "",
        teamId: "",
      },
    ],
    callerUid: "manager-a",
    search: "  NEEDLE  ",
  });

  assert.deepEqual(
    result.map((candidate) => candidate.uid),
    ["name-match", "email-match"],
  );
});

test("legacy users without teamId are treated as unassigned", () => {
  const result = resolveTeamMembershipCandidates({
    team: {
      id: "team-a",
      managerId: "manager-a",
      memberIds: [],
    },
    users: [
      {
        uid: "legacy-a",
        displayName: "Legacy User",
        email: "legacy@example.com",
        photoURL: "",
      },
    ],
    callerUid: "manager-a",
  });

  assert.deepEqual(result.map((candidate) => candidate.uid), ["legacy-a"]);
});

test("loads candidates only from unassigned and same-team queries", async () => {
  const queries = [];
  const rowsByTeamId = new Map([
    [
      "",
      [
        {
          id: "candidate-a",
          data: () => ({
            displayName: "Alice Candidate",
            email: "alice@example.com",
            photoURL: "https://example.com/alice.png",
            teamId: "",
          }),
        },
      ],
    ],
    [
      "team-a",
      [
        {
          id: "repair-a",
          data: () => ({
            displayName: "Riley Repair",
            email: "riley@example.com",
            photoURL: "https://example.com/riley.png",
            teamId: "team-a",
          }),
        },
      ],
    ],
  ]);

  const db = {
    collection(name) {
      assert.equal(name, "users");
      return {
        where(field, op, value) {
          queries.push({ field, op, value });
          assert.equal(field, "teamId");
          assert.equal(op, "==");
          return {
            async get() {
              return { docs: rowsByTeamId.get(value) ?? [] };
            },
          };
        },
      };
    },
  };

  const users = await loadTeamMembershipCandidateUsers(db, "team-a");

  assert.deepEqual(queries, [
    { field: "teamId", op: "==", value: "" },
    { field: "teamId", op: "==", value: "team-a" },
  ]);
  assert.deepEqual(users.map((user) => user.uid), [
    "candidate-a",
    "repair-a",
  ]);
});
