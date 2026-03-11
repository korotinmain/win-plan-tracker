import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  MatDialogRef,
  MAT_DIALOG_DATA,
  MatDialogModule,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

export interface HolidayInfoDialogData {
  holidayName: string;
  date: string; // YYYY-MM-DD
  countryCode: string | null;
  isWeekend: boolean;
}

@Component({
  selector: 'app-holiday-info-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
  ],
  templateUrl: './holiday-info-dialog.component.html',
  styleUrls: ['./holiday-info-dialog.component.scss'],
})
export class HolidayInfoDialogComponent {
  dialogRef = inject(MatDialogRef<HolidayInfoDialogComponent>);
  data: HolidayInfoDialogData = inject(MAT_DIALOG_DATA);

  get formattedDate(): string {
    // Parse as local date to avoid UTC offset shifting the day
    const [year, month, day] = this.data.date.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  get dayOfWeek(): string {
    const [year, month, day] = this.data.date.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    return d.toLocaleDateString('en-US', { weekday: 'long' });
  }

  close(): void {
    this.dialogRef.close();
  }
}
