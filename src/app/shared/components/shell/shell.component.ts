import { Component, inject, signal, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { filter, map } from 'rxjs/operators';
import { fromEvent } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../../core/services/auth.service';
import { PresenceService } from '../../../core/services/presence.service';
import { ThemeService } from '../../../core/services/theme.service';
import { AppUser } from '../../../core/models/user.model';
import { NotificationPanelComponent } from '../notification-panel/notification-panel.component';
import {
  DropdownMenuComponent,
  MenuItemComponent,
  MenuDividerComponent,
} from '../dropdown-menu/dropdown-menu.component';
import { getInitials } from '../../../shared/utils/initials.util';

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
    MatTooltipModule,
    NotificationPanelComponent,
    DropdownMenuComponent,
    MenuItemComponent,
    MenuDividerComponent,
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
  private destroyRef = inject(DestroyRef);

  currentUser: AppUser | null = null;
  sidenavOpen = signal(
    typeof window !== 'undefined' ? window.innerWidth > 768 : true,
  );

  private get isMobile(): boolean {
    return typeof window !== 'undefined' && window.innerWidth <= 768;
  }
  isDark = this.themeService.isDark;

  today = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  workspaceNav: NavItem[] = [
    { label: 'Dashboard', icon: 'dashboard', route: '/dashboard' },
    { label: 'Calendar', icon: 'calendar_month', route: '/calendar' },
    { label: 'Sprints', icon: 'rocket_launch', route: '/sprints' },
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
    this.authService.currentUser$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((user) => {
        this.currentUser = user ?? null;
      });

    // Close sidebar on mobile when navigating
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        if (this.isMobile) {
          this.sidenavOpen.set(false);
        }
      });

    // Auto-close when window resizes to mobile
    if (typeof window !== 'undefined') {
      fromEvent(window, 'resize')
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => {
          if (this.isMobile && this.sidenavOpen()) {
            this.sidenavOpen.set(false);
          }
        });
    }
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

  headerScrolled = signal(false);

  onPageScroll(event: Event): void {
    this.headerScrolled.set((event.target as HTMLElement).scrollTop > 4);
  }

  navigate(route: string): void {
    this.router.navigate([route]);
  }

  protected readonly getInitials = getInitials;

  private titleFromUrl(url: string): string {
    if (/^\/teams\/[^/]+\/settings/.test(url)) return 'Team Settings';
    if (/^\/sprints\/planning/.test(url)) return 'Sprint Planning';
    const match = this.allNavItems.find((i) => url.startsWith(i.route));
    return match?.label ?? 'Dashboard';
  }
}
