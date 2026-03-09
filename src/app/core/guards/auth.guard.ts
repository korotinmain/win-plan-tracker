import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { filter, map, take } from 'rxjs/operators';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // Skip undefined (loading) — wait until auth is actually resolved
  return auth.currentUser$.pipe(
    filter((user) => user !== undefined),
    take(1),
    map((user) => {
      if (user) return true;
      return router.createUrlTree(['/auth/login']);
    }),
  );
};

/** Redirect already-authenticated users away from auth pages */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.currentUser$.pipe(
    filter((user) => user !== undefined),
    take(1),
    map((user) => {
      if (!user) return true;
      return router.createUrlTree(['/dashboard']);
    }),
  );
};

export const roleGuard = (allowedRoles: string[]): CanActivateFn => {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    return auth.currentUser$.pipe(
      filter((user) => user !== undefined),
      take(1),
      map((user) => {
        if (user && allowedRoles.includes(user.role)) return true;
        return router.createUrlTree(['/dashboard']);
      }),
    );
  };
};
