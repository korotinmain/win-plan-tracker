import { initializeApp } from '@firebase/app';
import { getAuth } from '@firebase/auth';
import { getFirestore } from '@firebase/firestore';
import { getDatabase } from 'firebase/database';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { environment } from '../environments/environment';

export const firebaseApp = initializeApp(environment.firebase);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const rtdb = getDatabase(firebaseApp);
export const functions = getFunctions(firebaseApp);

// Connect to emulators in development
if (!environment.production) {
  connectFunctionsEmulator(functions, 'localhost', 5001);
}
