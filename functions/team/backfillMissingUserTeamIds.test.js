const test = require("node:test");
const assert = require("node:assert/strict");

const {
  backfillMissingUserTeamIds,
  collectMissingUserTeamIdDocs,
} = require("./backfillMissingUserTeamIds");

test("collects only docs that are missing teamId", () => {
  const docs = [
    {
      id: "legacy-a",
      ref: { id: "legacy-a" },
      data: () => ({ displayName: "Legacy A" }),
    },
    {
      id: "current-a",
      ref: { id: "current-a" },
      data: () => ({ displayName: "Current A", teamId: "" }),
    },
    {
      id: "current-b",
      ref: { id: "current-b" },
      data: () => ({ displayName: "Current B", teamId: "team-a" }),
    },
  ];

  assert.deepEqual(
    collectMissingUserTeamIdDocs(docs).map((doc) => doc.id),
    ["legacy-a"],
  );
});

test("dry run reports missing counts without writing", async () => {
  const logs = [];
  const db = {
    collection(name) {
      assert.equal(name, "users");
      return {
        async get() {
          return {
            size: 3,
            docs: [
              { id: "legacy-a", data: () => ({ displayName: "Legacy A" }) },
              {
                id: "current-a",
                data: () => ({ displayName: "Current A", teamId: "" }),
              },
              {
                id: "current-b",
                data: () => ({ displayName: "Current B", teamId: "team-a" }),
              },
            ],
          };
        },
      };
    },
    batch() {
      throw new Error("dry run should not create a batch");
    },
  };

  const result = await backfillMissingUserTeamIds({
    db,
    logger: { log: (message) => logs.push(message) },
    apply: false,
  });

  assert.deepEqual(result, {
    scanned: 3,
    updated: 0,
    missingTeamId: 1,
  });
  assert.deepEqual(logs, ["Dry run: 1 user docs are missing teamId."]);
});

test("apply mode writes teamId only for docs missing the field", async () => {
  const updates = [];
  const commits = [];

  const docs = [
    {
      id: "legacy-a",
      ref: { id: "legacy-a" },
      data: () => ({ displayName: "Legacy A" }),
    },
    {
      id: "current-a",
      ref: { id: "current-a" },
      data: () => ({ displayName: "Current A", teamId: "" }),
    },
    {
      id: "current-b",
      ref: { id: "current-b" },
      data: () => ({ displayName: "Current B", teamId: "team-a" }),
    },
  ];

  const db = {
    collection(name) {
      assert.equal(name, "users");
      return {
        async get() {
          return { size: docs.length, docs };
        },
      };
    },
    batch() {
      return {
        update(ref, payload) {
          updates.push({ ref: ref.id, payload });
        },
        async commit() {
          commits.push(updates.length);
        },
      };
    },
  };

  const result = await backfillMissingUserTeamIds({
    db,
    logger: { log() {} },
    apply: true,
  });

  assert.deepEqual(result, {
    scanned: 3,
    updated: 1,
    missingTeamId: 1,
  });
  assert.deepEqual(updates, [
    { ref: "legacy-a", payload: { teamId: "" } },
  ]);
  assert.deepEqual(commits, [1]);
});

test("apply mode batches large migrations", async () => {
  const updates = [];
  const commits = [];
  const docs = Array.from({ length: 451 }, (_, index) => ({
    id: `legacy-${index + 1}`,
    ref: { id: `legacy-${index + 1}` },
    data: () => ({ displayName: `Legacy ${index + 1}` }),
  }));

  const db = {
    collection(name) {
      assert.equal(name, "users");
      return {
        async get() {
          return { size: docs.length, docs };
        },
      };
    },
    batch() {
      return {
        update(ref, payload) {
          updates.push({ ref: ref.id, payload });
        },
        async commit() {
          commits.push(updates.length);
        },
      };
    },
  };

  const result = await backfillMissingUserTeamIds({
    db,
    logger: { log() {} },
    apply: true,
  });

  assert.equal(result.updated, 451);
  assert.deepEqual(commits, [450, 451]);
  assert.equal(updates.length, 451);
});
