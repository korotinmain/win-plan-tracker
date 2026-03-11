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
import { PresenceService } from '../../../core/services/presence.service';
import { ThemeService } from '../../../core/services/theme.service';
import { AppUser } from '../../../core/models/user.model';
import { NotificationPanelComponent } from '../notification-panel/notification-panel.component';

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
    NotificationPanelComponent,
  ],
  templateUrl: './shell.component.html',
  styleUrls: ['./shell.component.scss'],
})
export class ShellComponent {
  private authService = inject(AuthService);
  // Eagerly instantiate PresenceService so online tracking starts immediately
  // for the entire authenticated session, not just when Teams page is visited.
  private _presence = inject(PresenceService);
  private router = inject(Router);
  private themeService = inject(ThemeService);

  currentUser: AppUser | null = null;
  sidenavOpen = signal(true);
  isDark = this.themeService.isDark;

  today = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  workspaceNav: NavItem[] = [
    { label: 'Dashboard', icon: 'dashboard', route: '/dashboard' },
    { label: 'Calendar', icon: 'calendar_month', route: '/calendar' },
    { label: 'Team', icon: 'groups', route: '/teams', roles: ['admin'] },
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
  }

  isVisible(item: NavItem): boolean {
    const role = this.currentUser?.role ?? 'employee';
    return !item.roles || item.roles.includes(role);
  }

  toggleSidenav(): void {
    this.sidenavOpen.set(!this.sidenavOpen());
  }

  toggleTheme(): void {
    this.themeService.toggle();
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
