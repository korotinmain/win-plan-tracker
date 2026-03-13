import { Component, inject } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

declare function gtag(...args: unknown[]): void;

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet></router-outlet>',
})
export class AppComponent {
  constructor() {
    const router = inject(Router);
    router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((e: NavigationEnd) => {
        if (typeof gtag !== 'undefined') {
          gtag('event', 'page_view', {
            page_path: e.urlAfterRedirects,
            page_location: window.location.href,
          });
        }
      });
  }
}
