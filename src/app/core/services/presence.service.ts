import { Injectable, inject } from '@angular/core';
import {
  ref,
  set,
  remove,
  onValue,
  onDisconnect,
  serverTimestamp,
  Unsubscribe,
} from 'firebase/database';
import { Observable } from 'rxjs';
import { rtdb } from '../../firebase';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class PresenceService {
  private authService = inject(AuthService);

  /** Emits the current set of online UIDs whenever presence changes. */
  readonly onlineUids$: Observable<Set<string>> = new Observable((observer) => {
    const presenceRef = ref(rtdb, 'presence');
    const unsub: Unsubscribe = onValue(
      presenceRef,
      (snap) => {
        const uids = new Set<string>();
        snap.forEach((child) => {
          uids.add(child.key!);
        });
        observer.next(uids);
      },
      (err) => observer.error(err),
    );
    return () => unsub();
  });

  constructor() {
    let connUnsub: Unsubscribe | null = null;
    let trackedUid: string | null = null;

    this.authService.currentUser$.subscribe((user) => {
      if (user) {
        trackedUid = user.uid;

        // Stop any existing connection listener before re-attaching
        if (connUnsub) connUnsub();

        // .info/connected fires true when connected, false on disconnect
        connUnsub = onValue(ref(rtdb, '.info/connected'), (snap) => {
          if (!snap.val()) return; // not connected yet
          const presRef = ref(rtdb, `presence/${user.uid}`);
          // Auto-remove on network disconnect / tab close
          onDisconnect(presRef).remove();
          // Mark as online
          set(presRef, { uid: user.uid, lastSeen: serverTimestamp() });
        });
      } else {
        // User signed out — tear down listener and clear presence immediately
        if (connUnsub) {
          connUnsub();
          connUnsub = null;
        }
        if (trackedUid) {
          remove(ref(rtdb, `presence/${trackedUid}`));
          trackedUid = null;
        }
      }
    });
  }
}
