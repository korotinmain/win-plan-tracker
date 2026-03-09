import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { format, eachDayOfInterval, isWeekend, parseISO } from 'date-fns';
import { VacationService } from '../../../core/services/vacation.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-vacation-request-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './vacation-request-dialog.component.html',
  styleUrls: ['./vacation-request-dialog.component.scss'],
})
export class VacationRequestDialogComponent implements OnInit {
  private fb = inject(FormBuilder);
  private vacationService = inject(VacationService);
  private authService = inject(AuthService);
  private dialogRef = inject(MatDialogRef<VacationRequestDialogComponent>);

  loading = signal(false);
  error = signal('');
  workingDays = signal(0);
  minDate = new Date();

  form = this.fb.group({
    startDate: [null as Date | null, Validators.required],
    endDate: [null as Date | null, Validators.required],
    note: [''],
  });

  ngOnInit(): void {
    this.form.valueChanges.subscribe(() => this.calcWorkingDays());
  }

  private calcWorkingDays(): void {
    const { startDate, endDate } = this.form.value;
    if (!startDate || !endDate) {
      this.workingDays.set(0);
      return;
    }
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    this.workingDays.set(days.filter((d) => !isWeekend(d)).length);
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid || this.workingDays() === 0) return;
    const user = this.authService.currentUser!;
    this.loading.set(true);
    this.error.set('');
    try {
      const { startDate, endDate, note } = this.form.value;
      await this.vacationService.submitRequest({
        userId: user.uid,
        userName: user.displayName,
        teamId: user.teamId,
        managerId: '',
        startDate: format(startDate!, 'yyyy-MM-dd'),
        endDate: format(endDate!, 'yyyy-MM-dd'),
        workingDays: this.workingDays(),
        status: 'pending',
        note: note ?? undefined,
        createdAt: new Date(),
      });
      this.dialogRef.close(true);
    } catch (e: any) {
      this.error.set(e.message ?? 'Could not submit request.');
    } finally {
      this.loading.set(false);
    }
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}
