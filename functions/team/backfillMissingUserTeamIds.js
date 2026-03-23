function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isMissingTeamId(userData) {
  return !hasOwn(userData, "teamId");
}

function collectMissingUserTeamIdDocs(docs) {
  return Array.isArray(docs)
    ? docs.filter((docSnap) => isMissingTeamId(docSnap.data() || {}))
    : [];
}

async function backfillMissingUserTeamIds({
  db,
  logger = console,
  apply = false,
} = {}) {
  const firestore =
    db ||
    require("firebase-admin").firestore();
  const snap = await firestore.collection("users").get();
  const missingTeamIdDocs = collectMissingUserTeamIdDocs(snap.docs);

  if (!apply) {
    logger.log(
      `Dry run: ${missingTeamIdDocs.length} user docs are missing teamId.`,
    );
    return {
      scanned: snap.size,
      updated: 0,
      missingTeamId: missingTeamIdDocs.length,
    };
  }

  let updated = 0;
  let batch = db.batch();
  let batchWrites = 0;

  for (const docSnap of missingTeamIdDocs) {
    batch.update(docSnap.ref, { teamId: "" });
    batchWrites += 1;
    updated += 1;

    if (batchWrites === 450) {
      await batch.commit();
      batch = db.batch();
      batchWrites = 0;
    }
  }

  if (batchWrites > 0) {
    await batch.commit();
  }

  logger.log(`Backfilled teamId on ${updated} user docs.`);
  return {
    scanned: snap.size,
    updated,
    missingTeamId: missingTeamIdDocs.length,
  };
}

async function main() {
  const admin = require("firebase-admin");
  if (!admin.apps.length) {
    admin.initializeApp();
  }

  const apply = process.argv.includes("--apply");
  await backfillMissingUserTeamIds({ apply });
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {
  backfillMissingUserTeamIds,
  collectMissingUserTeamIdDocs,
  isMissingTeamId,
};
