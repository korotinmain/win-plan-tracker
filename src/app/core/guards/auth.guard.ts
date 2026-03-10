import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { filter, map, take } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.authState$.pipe(
    filter((state) => state.status !== 'loading'),
    take(1),
    map((state) =>
      state.status === 'authenticated'
        ? true
        : router.createUrlTree(['/login']),
    ),
  );
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.authState$.pipe(
    filter((state) => state.status !== 'loading'),
    take(1),
    map((state) =>
      state.status === 'authenticated'
        ? router.createUrlTree(['/dashboard'])
        : true,
    ),
  );
};

export const roleGuard = (allowedRoles: string[]): CanActivateFn => {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    return auth.authState$.pipe(
      filter((state) => state.status !== 'loading'),
      take(1),
      map((state) => {
        if (
          state.status === 'authenticated' &&
          state.user &&
          allowedRoles.includes(state.user.role)
        ) {
          return true;
        }
        return router.createUrlTree(['/dashboard']);
      }),
    );
  };
};
