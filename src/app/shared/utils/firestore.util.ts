import { Query, DocumentData, onSnapshot } from '@firebase/firestore';
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
