import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  isDark = signal(true);

  constructor() {
    document.documentElement.setAttribute('data-theme', 'dark');
  }

  toggle(): void {
    const next = !this.isDark();
    this.isDark.set(next);
    document.documentElement.setAttribute(
      'data-theme',
      next ? 'dark' : 'light',
    );
  }
}
