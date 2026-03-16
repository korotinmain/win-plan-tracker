import { Injectable, inject } from '@angular/core';
import {
  GoogleAuthProvider,
  User,
  createUserWithEmailAndPassword,
  getRedirectResult,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
} from '@firebase/auth';
import { doc, getDoc, setDoc } from '@firebase/firestore';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, map } from 'rxjs';
import { AppUser } from '../models/user.model';
import { auth, db } from '../../firebase';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  status: AuthStatus;
  user: AppUser | null;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private router = inject(Router);

  private authStateSubject = new BehaviorSubject<AuthState>({
    status: 'loading',
    user: null,
  });

  authState$: Observable<AuthState> = this.authStateSubject.asObservable();
  currentUser$: Observable<AppUser | null> = this.authState$.pipe(
    map((state) => state.user),
  );

  private initialSessionResolved = false;
  private authEventQueue = Promise.resolve();

  constructor() {
    this.bootstrapAuth();
  }

  get currentUser(): AppUser | null {
    return this.authStateSubject.value.user;
  }

  get authStatus(): AuthStatus {
    return this.authStateSubject.value.status;
  }

  /** Patch the in-memory user without a full Firestore round-trip. */
  patchCurrentUser(patch: Partial<AppUser>): void {
    const state = this.authStateSubject.value;
    if (!state.user) return;
    this.authStateSubject.next({ ...state, user: { ...state.user, ...patch } });
  }

  async loginWithEmail(email: string, password: string): Promise<void> {
    await signInWithEmailAndPassword(auth, email, password);
  }

  async loginWithGoogle(): Promise<void> {
    const provider = new GoogleAuthProvider();

    try {
      await signInWithPopup(auth, provider);
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code;
      if (
        code === 'auth/popup-blocked' ||
        code === 'auth/operation-not-supported-in-this-environment'
      ) {
        await signInWithRedirect(auth, provider);
        return;
      }
      throw e;
    }
  }

  async register(
    email: string,
    password: string,
    displayName: string,
  ): Promise<void> {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName });
    await this.upsertUserProfile(cred.user, 'employee', displayName);
  }

  async logout(): Promise<void> {
    await signOut(auth);
    this.setUnauthenticated();
    await this.router.navigate(['/login']);
  }

  private bootstrapAuth(): void {
    const redirectUserPromise = getRedirectResult(auth)
      .then((result) => result?.user ?? null)
      .catch((e) => {
        console.error('Could not resolve Google redirect result:', e);
        return null;
      });

    onAuthStateChanged(auth, (firebaseUser) => {
      this.authEventQueue = this.authEventQueue
        .then(() => this.handleAuthChange(firebaseUser, redirectUserPromise))
        .catch((e) => {
          console.error('Auth state processing failed:', e);
          this.setUnauthenticated();
        });
    });
  }

  private async handleAuthChange(
    firebaseUser: User | null,
    redirectUserPromise: Promise<User | null>,
  ): Promise<void> {
    if (firebaseUser) {
      this.initialSessionResolved = true;
      await this.setAuthenticated(firebaseUser);
      return;
    }

    // Firebase may emit null before redirect result settles.
    if (!this.initialSessionResolved) {
      const redirectUser = await redirectUserPromise;
      if (redirectUser) {
        this.initialSessionResolved = true;
        await this.setAuthenticated(redirectUser);
        return;
      }
      this.initialSessionResolved = true;
    }

    this.setUnauthenticated();
  }

  private async setAuthenticated(firebaseUser: User): Promise<void> {
    const appUser = await this.resolveAppUser(firebaseUser);
    this.authStateSubject.next({ status: 'authenticated', user: appUser });
    this.navigateAwayFromGuestPages();
  }

  private setUnauthenticated(): void {
    this.authStateSubject.next({ status: 'unauthenticated', user: null });
    this.navigateToLoginFromProtectedPages();
  }

  private async resolveAppUser(firebaseUser: User): Promise<AppUser> {
    try {
      const existing = await this.fetchUserProfile(firebaseUser.uid);
      if (existing) {
        return this.mergeFirebaseFields(existing, firebaseUser);
      }
      return await this.createUserProfile(firebaseUser, 'employee');
    } catch (e) {
      console.error('Failed to resolve user profile, using fallback user:', e);
      return this.buildFallbackUser(firebaseUser);
    }
  }

  private mergeFirebaseFields(profile: AppUser, firebaseUser: User): AppUser {
    return {
      ...profile,
      email: firebaseUser.email ?? profile.email,
      displayName:
        firebaseUser.displayName ??
        profile.displayName ??
        firebaseUser.email ??
        'User',
      photoURL: firebaseUser.photoURL ?? profile.photoURL,
    };
  }

  private buildFallbackUser(firebaseUser: User): AppUser {
    return {
      uid: firebaseUser.uid,
      email: firebaseUser.email ?? '',
      displayName: firebaseUser.displayName ?? firebaseUser.email ?? 'User',
      role: 'employee',
      teamId: '',
      photoURL: firebaseUser.photoURL ?? undefined,
      createdAt: new Date(),
    };
  }

  private navigateAwayFromGuestPages(): void {
    const url = this.router.url;
    const path = location.pathname;
    if (
      url.startsWith('/login') ||
      url.startsWith('/register') ||
      path.startsWith('/login') ||
      path.startsWith('/register') ||
      path === '/'
    ) {
      void this.router.navigate(['/dashboard']);
    }
  }

  private navigateToLoginFromProtectedPages(): void {
    const url = this.router.url;
    if (
      url.startsWith('/login') ||
      url.startsWith('/register') ||
      url === '/'
    ) {
      return;
    }
    void this.router.navigate(['/login']);
  }

  private async fetchUserProfile(uid: string): Promise<AppUser | null> {
    const ref = doc(db, `users/${uid}`);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;

    const raw = snap.data() as Partial<AppUser> & {
      createdAt?: unknown;
      role?: unknown;
    };

    return {
      uid,
      email: raw.email ?? '',
      displayName: raw.displayName ?? raw.email ?? 'User',
      role: this.normalizeRole(raw.role),
      teamId: raw.teamId ?? '',
      photoURL: raw.photoURL ?? undefined,
      createdAt: this.normalizeDate(raw.createdAt),
    };
  }

  private async createUserProfile(
    firebaseUser: User,
    role: AppUser['role'],
  ): Promise<AppUser> {
    const user: AppUser = {
      uid: firebaseUser.uid,
      email: firebaseUser.email ?? '',
      displayName:
        firebaseUser.displayName ?? firebaseUser.email?.split('@')[0] ?? 'User',
      role,
      teamId: '',
      photoURL: firebaseUser.photoURL ?? undefined,
      createdAt: new Date(),
    };
    await setDoc(doc(db, `users/${user.uid}`), user);
    return user;
  }

  private async upsertUserProfile(
    firebaseUser: User,
    role: AppUser['role'],
    displayName: string,
  ): Promise<void> {
    const existing = await this.fetchUserProfile(firebaseUser.uid);
    const now = new Date();

    if (existing) {
      await setDoc(
        doc(db, `users/${firebaseUser.uid}`),
        {
          email: firebaseUser.email ?? existing.email,
          displayName:
            displayName || firebaseUser.displayName || existing.displayName,
          photoURL: firebaseUser.photoURL ?? existing.photoURL ?? null,
        },
        { merge: true },
      );
      return;
    }

    await setDoc(
      doc(db, `users/${firebaseUser.uid}`),
      {
        uid: firebaseUser.uid,
        email: firebaseUser.email ?? '',
        displayName: displayName || firebaseUser.displayName || 'User',
        role,
        teamId: '',
        photoURL: firebaseUser.photoURL ?? null,
        createdAt: now,
      },
      { merge: true },
    );
  }

  private normalizeRole(role: unknown): AppUser['role'] {
    if (role === 'admin' || role === 'manager' || role === 'employee') {
      return role;
    }
    return 'employee';
  }

  private normalizeDate(input: unknown): Date {
    if (input instanceof Date) return input;
    if (
      typeof input === 'object' &&
      input !== null &&
      'toDate' in input &&
      typeof (input as { toDate: () => Date }).toDate === 'function'
    ) {
      return (input as { toDate: () => Date }).toDate();
    }
    return new Date();
  }
}
