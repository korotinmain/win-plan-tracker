import { DocumentReference } from '@firebase/firestore';
import { docObservable } from './firestore.util';

describe('firestore.util', () => {
  it('docObservable maps a document snapshot to data', () => {
    const unsubscribe = jasmine.createSpy('unsubscribe');
    const listen = jasmine.createSpy('listen').and.callFake(
      (ref: unknown, next: (snapshot: any) => void) => {
      expect(ref).toEqual({} as DocumentReference);
        next({
          exists: () => true,
          id: 'team-1',
          data: () => ({ id: 'team-1', name: 'Alpha' }),
        });
        return unsubscribe;
      },
    );

    const values: Array<{ id: string; name: string }> = [];
    const subscription = docObservable<{ id: string; name: string }>(
      {} as DocumentReference,
      listen as any,
    ).subscribe({
      next: (team) => {
        if (team) {
          values.push(team);
        }
      },
      error: fail,
    });

    expect(values).toEqual([{ id: 'team-1', name: 'Alpha' }]);
    expect(listen).toHaveBeenCalledOnceWith(
      {} as DocumentReference,
      jasmine.any(Function),
      jasmine.any(Function),
    );
    expect(unsubscribe).not.toHaveBeenCalled();
    subscription.unsubscribe();
    expect(unsubscribe).toHaveBeenCalled();
  });
});
