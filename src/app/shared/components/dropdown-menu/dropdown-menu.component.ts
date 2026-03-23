import {
  Component,
  Input,
  Output,
  EventEmitter,
  TemplateRef,
  ViewChild,
  OnDestroy,
  ChangeDetectionStrategy,
  signal,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  Overlay,
  OverlayModule,
  OverlayRef,
  FlexibleConnectedPositionStrategy,
} from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { ViewContainerRef } from '@angular/core';
import { Subscription } from 'rxjs';

export type DropdownMenuYPosition = 'above' | 'below';
export type DropdownMenuXPosition = 'before' | 'after';

/** A single item inside a dropdown menu. */
@Component({
  selector: 'app-menu-item',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      class="dm-item"
      [class.dm-item--danger]="danger"
      [class.dm-item--disabled]="disabled"
      [disabled]="disabled"
      type="button"
      role="menuitem"
      (click)="!disabled && itemClick.emit()"
    >
      <ng-content></ng-content>
    </button>
  `,
  styles: [
    `
      :host {
        display: contents;
      }
      .dm-item {
        all: unset;
        display: flex;
        align-items: center;
        gap: 11px;
        width: 100%;
        min-height: 42px;
        padding: 0 12px;
        border-radius: 10px;
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        position: relative;
        overflow: hidden;
        transition:
          background 0.15s ease,
          color 0.15s ease;
        color: var(--dm-item-color, var(--c-text));
        box-sizing: border-box;

        /* sliding left accent bar */
        &::before {
          content: '';
          position: absolute;
          left: 1px;
          top: 50%;
          transform: translateY(-50%) scaleY(0);
          width: 2.5px;
          height: 18px;
          border-radius: 2px;
          background: var(
            --dm-accent-bar,
            linear-gradient(180deg, #6366f1, #8b5cf6)
          );
          transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        &:hover:not(:disabled) {
          background: var(--dm-item-hover-bg);
          &::before {
            transform: translateY(-50%) scaleY(1);
          }
        }

        &--danger {
          --dm-item-color: #dc2626;
          --dm-accent-bar: linear-gradient(180deg, #ef4444, #dc2626);
          &:hover:not(:disabled) {
            background: rgba(239, 68, 68, 0.08) !important;
          }
        }

        &--disabled {
          opacity: 0.4;
          cursor: default;
        }
      }
    `,
  ],
})
export class MenuItemComponent {
  @Input() danger = false;
  @Input() disabled = false;
  @Output() itemClick = new EventEmitter<void>();
}

/** A visual divider separator. */
@Component({
  selector: 'app-menu-divider',
  standalone: true,
  template: `<div class="dm-divider"></div>`,
  styles: [
    `
      :host {
        display: block;
        margin: 4px 0;
      }
      .dm-divider {
        height: 1px;
        background: linear-gradient(
          90deg,
          transparent 0%,
          var(--dm-divider-color, rgba(99, 102, 241, 0.12)) 30%,
          var(--dm-divider-color, rgba(99, 102, 241, 0.18)) 50%,
          var(--dm-divider-color, rgba(99, 102, 241, 0.12)) 70%,
          transparent 100%
        );
      }
    `,
  ],
})
export class MenuDividerComponent {}

/**
 * Luxe custom dropdown menu — CDK Overlay based.
 * Supports both light and dark themes out of the box.
 *
 * Usage:
 *   <app-dropdown-menu #myMenu yPosition="below" xPosition="before">
 *     <app-menu-item (itemClick)="doSomething()">…</app-menu-item>
 *     <app-menu-divider></app-menu-divider>
 *     <app-menu-item danger (itemClick)="deleteIt()">…</app-menu-item>
 *   </app-dropdown-menu>
 *
 *   <button (click)="myMenu.open($event.currentTarget)">Open</button>
 */
@Component({
  selector: 'app-dropdown-menu',
  standalone: true,
  imports: [CommonModule, OverlayModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-template #panelTpl>
      <div
        class="dm-panel"
        [class.dm-panel--wide]="wide"
        role="menu"
        (click)="onPanelClick($event)"
      >
        <ng-content select="[slot=header]"></ng-content>
        <div class="dm-items">
          <ng-content></ng-content>
        </div>
      </div>
    </ng-template>
  `,
  styleUrls: ['./dropdown-menu.component.scss'],
})
export class DropdownMenuComponent implements OnDestroy {
  @Input() yPosition: DropdownMenuYPosition = 'below';
  @Input() xPosition: DropdownMenuXPosition = 'before';
  /** For the user profile panel which is wider */
  @Input() wide = false;
  /** Offset from the trigger in px */
  @Input() offsetY = 8;

  @Output() opened = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();

  isOpen = signal(false);

  @ViewChild('panelTpl', { static: true }) panelTpl!: TemplateRef<void>;

  private overlay = inject(Overlay);
  private vcr = inject(ViewContainerRef);
  private overlayRef: OverlayRef | null = null;
  private backdropSub?: Subscription;
  private detachSub?: Subscription;

  open(trigger: HTMLElement | EventTarget | null): void {
    if (!trigger || this.isOpen()) return;

    const positionStrategy = this.buildPositionStrategy(trigger as HTMLElement);

    this.overlayRef = this.overlay.create({
      positionStrategy,
      hasBackdrop: true,
      backdropClass: 'dm-overlay-backdrop',
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
    });

    const portal = new TemplatePortal(this.panelTpl, this.vcr);
    this.overlayRef.attach(portal);
    this.isOpen.set(true);
    this.opened.emit();

    this.backdropSub = this.overlayRef
      .backdropClick()
      .subscribe(() => this.close());
    this.detachSub = this.overlayRef.detachments().subscribe(() => {
      this.isOpen.set(false);
      this.closed.emit();
    });
  }

  close(): void {
    if (this.overlayRef?.hasAttached()) {
      this.overlayRef.detach();
    }
    this.isOpen.set(false);
  }

  toggle(trigger: HTMLElement | EventTarget | null): void {
    this.isOpen() ? this.close() : this.open(trigger);
  }

  /** Clicking inside the panel should NOT close it unless an item was clicked */
  onPanelClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    const item = target.closest('.dm-item') as HTMLButtonElement | null;
    if (item && !item.disabled) {
      // Give the (itemClick) handler a tick to fire, then close
      setTimeout(() => this.close(), 0);
    }
  }

  private buildPositionStrategy(
    trigger: HTMLElement,
  ): FlexibleConnectedPositionStrategy {
    const originX = this.xPosition === 'before' ? 'end' : 'start';
    const overlayX = this.xPosition === 'before' ? 'end' : 'start';
    const originY = this.yPosition === 'below' ? 'bottom' : 'top';
    const overlayY = this.yPosition === 'below' ? 'top' : 'bottom';
    const offsetYValue =
      this.yPosition === 'below' ? this.offsetY : -this.offsetY;

    return this.overlay
      .position()
      .flexibleConnectedTo(trigger)
      .withPositions([
        { originX, originY, overlayX, overlayY, offsetY: offsetYValue },
        // fallback: flip side if not enough space
        {
          originX,
          originY: originY === 'bottom' ? 'top' : 'bottom',
          overlayX,
          overlayY: overlayY === 'top' ? 'bottom' : 'top',
          offsetY: -offsetYValue,
        },
      ])
      .withPush(false);
  }

  ngOnDestroy(): void {
    this.backdropSub?.unsubscribe();
    this.detachSub?.unsubscribe();
    this.overlayRef?.dispose();
  }
}
