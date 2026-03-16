import { Injectable, signal } from '@angular/core';

const THEME_KEY = 'app-theme';

function readStoredTheme(): boolean {
  try {
    return localStorage.getItem(THEME_KEY) !== 'light';
  } catch {
    return true; // default dark when localStorage is unavailable (SSR / tests)
  }
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  isDark = signal(readStoredTheme());

  constructor() {
    document.documentElement.setAttribute(
      'data-theme',
      this.isDark() ? 'dark' : 'light',
    );
  }

  toggle(): void {
    const next = !this.isDark();
    this.isDark.set(next);
    try {
      localStorage.setItem(THEME_KEY, next ? 'dark' : 'light');
    } catch {
      // localStorage unavailable — preference won't persist across sessions
    }
    document.documentElement.setAttribute(
      'data-theme',
      next ? 'dark' : 'light',
    );
  }
}
