import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { filter, map } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../../core/services/auth.service';
import { AppUser } from '../../../core/models/user.model';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  roles?: string[];
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatDividerModule,
    MatTooltipModule,
  ],
  templateUrl: './shell.component.html',
  styleUrls: ['./shell.component.scss'],
})
export class ShellComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  currentUser: AppUser | null = null;
  sidenavOpen = signal(true);
  isDark = signal(true);

  today = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  workspaceNav: NavItem[] = [
    { label: 'Dashboard', icon: 'dashboard', route: '/dashboard' },
    { label: 'Calendar', icon: 'calendar_month', route: '/calendar' },
    { label: 'Teams', icon: 'groups', route: '/teams', roles: ['admin'] },
  ];

  accountNav: NavItem[] = [
    { label: 'Settings', icon: 'tune', route: '/settings' },
  ];

  private allNavItems = [...this.workspaceNav, ...this.accountNav];

  pageTitle = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.titleFromUrl(this.router.url)),
    ),
    { initialValue: this.titleFromUrl(this.router.url) },
  );

  constructor() {
    this.authService.currentUser$.subscribe((user) => {
      this.currentUser = user ?? null;
    });
    // Apply dark theme by default
    document.documentElement.setAttribute('data-theme', 'dark');
  }

  isVisible(item: NavItem): boolean {
    const role = this.currentUser?.role ?? 'employee';
    return !item.roles || item.roles.includes(role);
  }

  toggleSidenav(): void {
    this.sidenavOpen.set(!this.sidenavOpen());
  }

  toggleTheme(): void {
    const next = this.isDark() ? 'light' : 'dark';
    this.isDark.set(!this.isDark());
    document.documentElement.setAttribute('data-theme', next);
  }

  async logout(): Promise<void> {
    await this.authService.logout();
  }

  getInitials(name: string): string {
    return (
      (name ?? '')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((n) => n[0])
        .join('')
        .toUpperCase() || '?'
    );
  }

  private titleFromUrl(url: string): string {
    const match = this.allNavItems.find((i) => url.startsWith(i.route));
    return match?.label ?? 'Dashboard';
  }
}
