import { Injectable, signal } from '@angular/core';

const THEME_KEY = 'app-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  isDark = signal(localStorage.getItem(THEME_KEY) !== 'light');

  constructor() {
    document.documentElement.setAttribute(
      'data-theme',
      this.isDark() ? 'dark' : 'light',
    );
  }

  toggle(): void {
    const next = !this.isDark();
    this.isDark.set(next);
    localStorage.setItem(THEME_KEY, next ? 'dark' : 'light');
    document.documentElement.setAttribute(
      'data-theme',
      next ? 'dark' : 'light',
    );
  }
}
