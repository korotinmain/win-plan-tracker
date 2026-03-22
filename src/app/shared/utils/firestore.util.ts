import {
  Query,
  DocumentData,
  DocumentReference,
  onSnapshot,
} from '@firebase/firestore';
import { Observable } from 'rxjs';

/**
 * Wraps a Firestore query in an RxJS Observable that completes when unsubscribed.
 * Shared across all services to avoid copy-paste.
 */
export function snapObservable<T>(q: Query<DocumentData>): Observable<T[]> {
  return new Observable<T[]>((subscriber) => {
    const unsub = onSnapshot(
      q,
      (snap) =>
        subscriber.next(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T)),
      (err) => subscriber.error(err),
    );
    return unsub;
  });
}

/**
 * Wraps a Firestore document reference in an RxJS Observable that emits `null`
 * when the document does not exist and completes only when unsubscribed.
 */
export function docObservable<T>(
  ref: DocumentReference<DocumentData>,
  listen: typeof onSnapshot = onSnapshot,
): Observable<T | null> {
  return new Observable<T | null>((subscriber) => {
    const unsub = listen(
      ref,
      (snap) => {
        subscriber.next(
          snap.exists()
            ? ({ id: snap.id, ...snap.data() } as T)
            : null,
        );
      },
      (err) => subscriber.error(err),
    );
    return unsub;
  });
}
