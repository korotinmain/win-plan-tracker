import { MatDialogConfig } from '@angular/material/dialog';

/**
 * Standard config for all premium dialogs (transparent surface,
 * blurred backdrop, custom border-radius via panelClass).
 */
export const KPI_DIALOG_CONFIG: Pick<
  MatDialogConfig,
  'panelClass' | 'backdropClass' | 'maxWidth'
> = {
  panelClass: 'kpi-dialog-panel',
  backdropClass: 'kpi-dialog-backdrop',
  maxWidth: '95vw',
};

/** Wider variant used for the upcoming vacations list. */
export const EVENTS_DIALOG_CONFIG: Pick<
  MatDialogConfig,
  'panelClass' | 'backdropClass' | 'maxWidth' | 'width'
> = {
  ...KPI_DIALOG_CONFIG,
  width: '580px',
};
