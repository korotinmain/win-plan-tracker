import { Injectable, inject } from '@angular/core';
import {
  signInWithEmailAndPassword,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  User,
  createUserWithEmailAndPassword,
  updateProfile,
} from '@firebase/auth';
import { doc, setDoc, getDoc } from '@firebase/firestore';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';
import { AppUser } from '../models/user.model';
import { auth, db } from '../../firebase';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private router = inject(Router);

  // undefined = auth not yet initialized, null = not logged in
  private currentUserSubject = new BehaviorSubject<AppUser | null | undefined>(
    undefined,
  );
  currentUser$: Observable<AppUser | null | undefined> =
    this.currentUserSubject.asObservable();

  constructor() {
    // Complete any pending Google redirect before onAuthStateChanged resolves.
    // Without this call Firebase v9 fires onAuthStateChanged with null and
    // discards the OAuth result, leaving the user stuck on the login page.
    getRedirectResult(auth).catch(() => {
      // Ignore — just ensures the pending redirect is processed.
    });

    onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Firebase Auth says the user IS logged in — never emit null here,
        // even if the Firestore profile fetch fails (network/permission error).
        // Emitting null would cause the auth guard to redirect to /login.
        try {
          let appUser = await this.fetchUserProfile(firebaseUser.uid);
          if (!appUser) {
            appUser = await this.createUserProfile(firebaseUser, 'employee');
          }
          this.currentUserSubject.next(appUser);
          // Navigate away from login after Google redirect or page reload
          if (this.router.url === '/auth/login' || this.router.url === '/') {
            this.router.navigate(['/dashboard']);
          }
        } catch (e) {
          console.error(
            'Could not fetch user profile, using minimal fallback:',
            e,
          );
          // Build a minimal AppUser from the Firebase Auth user so the session
          // stays alive even when Firestore is temporarily unreachable.
          const fallback: AppUser = {
            uid: firebaseUser.uid,
            email: firebaseUser.email ?? '',
            displayName:
              firebaseUser.displayName ?? firebaseUser.email ?? 'User',
            role: 'employee',
            teamId: '',
            companyId: '',
            createdAt: new Date(),
          };
          this.currentUserSubject.next(fallback);
        }
      } else {
        // Firebase Auth explicitly says signed out — clear the session.
        this.currentUserSubject.next(null);
      }
    });
  }

  get currentUser(): AppUser | null | undefined {
    return this.currentUserSubject.value;
  }

  async loginWithEmail(email: string, password: string): Promise<void> {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const user = await this.fetchUserProfile(cred.user.uid);
    this.currentUserSubject.next(user);
    this.router.navigate(['/dashboard']);
  }

  async loginWithGoogle(): Promise<void> {
    const provider = new GoogleAuthProvider();
    await signInWithRedirect(auth, provider);
    // Page will redirect to Google and come back — result handled in constructor
  }

  async register(
    email: string,
    password: string,
    displayName: string,
  ): Promise<void> {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName });
    const user = await this.createUserProfile(cred.user, 'employee');
    this.currentUserSubject.next(user);
    this.router.navigate(['/dashboard']);
  }

  async logout(): Promise<void> {
    await signOut(auth);
    this.currentUserSubject.next(null);
    this.router.navigate(['/auth/login']);
  }

  private async fetchUserProfile(uid: string): Promise<AppUser | null> {
    const ref = doc(db, `users/${uid}`);
    const snap = await getDoc(ref);
    return snap.exists() ? (snap.data() as AppUser) : null;
  }

  private async createUserProfile(
    firebaseUser: User,
    role: AppUser['role'],
  ): Promise<AppUser> {
    const user: AppUser = {
      uid: firebaseUser.uid,
      email: firebaseUser.email!,
      displayName:
        firebaseUser.displayName || firebaseUser.email!.split('@')[0],
      role,
      teamId: '',
      companyId: '',
      photoURL: firebaseUser.photoURL || undefined,
      createdAt: new Date(),
    };
    await setDoc(doc(db, `users/${user.uid}`), user);
    return user;
  }
}
