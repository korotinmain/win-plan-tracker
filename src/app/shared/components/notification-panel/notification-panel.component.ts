import {
  Component,
  inject,
  signal,
  computed,
  HostListener,
  DestroyRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthService } from '../../../core/services/auth.service';
import { AppNotification } from '../../../core/models/notification.model';
import {
  format,
  formatDistanceToNow,
  parseISO,
  isToday,
  isYesterday,
} from 'date-fns';
import { getInitials } from '../../../shared/utils/initials.util';
import { getAvatarGradient } from '../../../shared/utils/avatar.util';

@Component({
  selector: 'app-notification-panel',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './notification-panel.component.html',
  styleUrls: ['./notification-panel.component.scss'],
})
export class NotificationPanelComponent {
  private notifService = inject(NotificationService);
  private authService = inject(AuthService);
  private destroyRef = inject(DestroyRef);

  isOpen = signal(false);
  markingAll = signal(false);

  /** All notifications for the current user (live). */
  readonly notifications = signal<AppNotification[]>([]);

  unreadCount = computed(
    () => this.notifications().filter((n) => !n.read).length,
  );
  hasNew = computed(() => this.unreadCount() > 0);

  todayNotifs = computed(() =>
    this.notifications().filter((n) => {
      const d = this._toDate(n.createdAt);
      return isToday(d);
    }),
  );

  earlierNotifs = computed(() =>
    this.notifications().filter((n) => {
      const d = this._toDate(n.createdAt);
      return !isToday(d);
    }),
  );

  constructor() {
    // Re-subscribe whenever the auth user changes
    this.authService.currentUser$
      .pipe(
        switchMap((user) => {
          if (!user) return of([] as AppNotification[]);
          return this.notifService
            .getNotifications(user.uid)
            .pipe(catchError(() => of([] as AppNotification[])));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((list) => this.notifications.set(list));
  }

  togglePanel(e: MouseEvent): void {
    e.stopPropagation();
    this.isOpen.update((v) => !v);
  }

  @HostListener('document:click')
  onDocClick(): void {
    if (this.isOpen()) this.isOpen.set(false);
  }

  onPanelClick(e: MouseEvent): void {
    e.stopPropagation();
  }

  async onItemClick(n: AppNotification): Promise<void> {
    if (!n.read) {
      await this.notifService.markAsRead(n.id);
    }
  }

  async markAllRead(): Promise<void> {
    if (this.markingAll()) return;
    this.markingAll.set(true);
    try {
      await this.notifService.markAllAsRead(this.notifications());
    } finally {
      this.markingAll.set(false);
    }
  }

  timeAgo(createdAt: any): string {
    try {
      const d = this._toDate(createdAt);
      if (isToday(d)) return formatDistanceToNow(d, { addSuffix: true });
      if (isYesterday(d)) return 'Yesterday';
      return format(d, 'MMM d');
    } catch {
      return '';
    }
  }

  dateRangeLabel(n: AppNotification): string {
    try {
      const start = parseISO(n.startDate);
      const end = n.endDate ? parseISO(n.endDate) : null;
      if (!end || n.startDate === n.endDate) return format(start, 'MMM d');
      if (start.getFullYear() === end.getFullYear()) {
        return `${format(start, 'MMM d')} – ${format(end, 'MMM d')}`;
      }
      return `${format(start, 'MMM d, yyyy')} – ${format(end, 'MMM d, yyyy')}`;
    } catch {
      return n.startDate;
    }
  }

  protected readonly initials = getInitials;
  protected readonly avatarGradient = getAvatarGradient;

  private _toDate(val: any): Date {
    if (val instanceof Date) return val;
    if (typeof val?.toDate === 'function') return val.toDate();
    return new Date(val);
  }
}
