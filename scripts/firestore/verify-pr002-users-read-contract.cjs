'use strict';

const { initializeApp, deleteApp } = require('firebase/app');
const {
  connectAuthEmulator,
  inMemoryPersistence,
  initializeAuth,
  signInAnonymously,
} = require('firebase/auth');
const {
  collection,
  connectFirestoreEmulator,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  setDoc,
} = require('firebase/firestore');

const PROJECT_ID = 'phase1-rules-check';
const AUTH_EMULATOR_URL = 'http://127.0.0.1:9098';
const FIRESTORE_HOST = '127.0.0.1';
const FIRESTORE_PORT = 8088;

function createClient(name) {
  const app = initializeApp(
    {
      apiKey: 'fake',
      authDomain: `${PROJECT_ID}.firebaseapp.com`,
      projectId: PROJECT_ID,
    },
    `verify-pr002-${name}`,
  );
  const auth = initializeAuth(app, { persistence: inMemoryPersistence });
  connectAuthEmulator(auth, AUTH_EMULATOR_URL, { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, FIRESTORE_HOST, FIRESTORE_PORT);
  return { app, auth, db };
}

async function createSignedInUser(name, profile) {
  const client = createClient(name);
  const credential = await signInAnonymously(client.auth);
  const uid = credential.user.uid;

  await setDoc(doc(client.db, 'users', uid), {
    displayName: profile.displayName,
    email: profile.email,
    role: profile.role,
    teamId: profile.teamId,
    uid,
  });

  return { ...client, uid };
}

function isPermissionDenied(error) {
  const code = error && error.code;
  const message = String(error && error.message ? error.message : '');
  return code === 'permission-denied' || message.includes('Missing or insufficient permissions');
}

async function expectAllowed(label, fn) {
  try {
    const result = await fn();
    console.log(`[PASS] ${label}`);
    return result;
  } catch (error) {
    console.error(`[FAIL] ${label}`);
    throw error;
  }
}

async function expectDenied(label, fn) {
  try {
    await fn();
    throw new Error(`${label} unexpectedly succeeded`);
  } catch (error) {
    if (!isPermissionDenied(error)) {
      console.error(`[FAIL] ${label}`);
      throw error;
    }
    console.log(`[PASS] ${label}`);
  }
}

async function main() {
  const clients = [];

  try {
    const signedOut = createClient('signed-out');
    const admin = await createSignedInUser('admin', {
      displayName: 'Admin User',
      email: 'admin@example.com',
      role: 'admin',
      teamId: '',
    });
    const member = await createSignedInUser('member', {
      displayName: 'Team Member',
      email: 'member@example.com',
      role: 'employee',
      teamId: 'team-alpha',
    });
    const outsider = await createSignedInUser('outsider', {
      displayName: 'Outside User',
      email: 'outsider@example.com',
      role: 'employee',
      teamId: '',
    });
    const noTeam = await createSignedInUser('no-team', {
      displayName: 'No Team User',
      email: 'noteam@example.com',
      role: 'employee',
      teamId: '',
    });

    clients.push(signedOut, admin, member, outsider, noTeam);

    await setDoc(doc(admin.db, 'teams', 'team-alpha'), {
      id: 'team-alpha',
      icon: 'alpha',
      managerId: admin.uid,
      memberIds: [admin.uid, member.uid],
      name: 'Team Alpha',
    });

    await setDoc(doc(admin.db, 'teams', 'team-beta'), {
      id: 'team-beta',
      icon: 'beta',
      managerId: admin.uid,
      memberIds: [admin.uid],
      name: 'Team Beta',
    });

    await expectAllowed('1. signed-in user can read another user\'s profile doc', async () => {
      const snapshot = await getDoc(doc(member.db, 'users', outsider.uid));
      if (!snapshot.exists()) {
        throw new Error('Expected another user profile to exist');
      }
    });

    await expectAllowed('2. signed-in user can query users collection', async () => {
      const snapshot = await getDocs(collection(member.db, 'users'));
      if (snapshot.size !== 4) {
        throw new Error(`Expected 4 user docs, found ${snapshot.size}`);
      }
    });

    await expectAllowed('3. existing team member can read their own team', async () => {
      const snapshot = await getDoc(doc(member.db, 'teams', 'team-alpha'));
      if (!snapshot.exists()) {
        throw new Error('Expected team-alpha to exist');
      }
    });

    await expectDenied('4. joined user cannot read an unrelated team', async () => {
      await getDoc(doc(member.db, 'teams', 'team-beta'));
    });

    await expectAllowed('5. no-team user can query teams for join/discovery', async () => {
      const snapshot = await getDocs(collection(noTeam.db, 'teams'));
      if (snapshot.size !== 2) {
        throw new Error(`Expected 2 team docs, found ${snapshot.size}`);
      }
    });

    await expectAllowed('6. elevated role can still read teams broadly', async () => {
      const snapshot = await getDocs(collection(admin.db, 'teams'));
      if (snapshot.size !== 2) {
        throw new Error(`Expected 2 team docs, found ${snapshot.size}`);
      }
    });

    await expectDenied('7. signed-out user cannot read another user profile doc', async () => {
      await getDoc(doc(signedOut.db, 'users', outsider.uid));
    });

    await expectDenied('8. signed-out user cannot read teams collection', async () => {
      await getDocs(collection(signedOut.db, 'teams'));
    });

    console.log('PR-002 users/team read contract verification passed.');
  } finally {
    await Promise.allSettled(clients.map((client) => deleteApp(client.app)));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
