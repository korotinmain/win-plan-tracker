const test = require("node:test");
const assert = require("node:assert/strict");

const {
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
