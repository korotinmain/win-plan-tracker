import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatTableModule } from '@angular/material/table';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { format } from 'date-fns';
import { CalendarService } from '../../../core/services/calendar.service';
import { AuthService } from '../../../core/services/auth.service';
import { Holiday } from '../../../core/models/event.model';

@Component({
  selector: 'app-holidays',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatTableModule,
    MatSnackBarModule,
  ],
  templateUrl: './holidays.component.html',
  styleUrls: ['./holidays.component.scss'],
})
export class HolidaysComponent implements OnInit {
  private calendarService = inject(CalendarService);
  private authService = inject(AuthService);
  private snackBar = inject(MatSnackBar);
  private fb = inject(FormBuilder);

  currentUser = this.authService.currentUser;
  holidays = signal<Holiday[]>([]);
  displayedColumns = ['name', 'date', 'recurring', 'actions'];

  form = this.fb.group({
    name: ['', Validators.required],
    date: [null as Date | null, Validators.required],
    recurring: [true],
  });

  ngOnInit(): void {
    if (!this.currentUser?.companyId) return;
    this.calendarService
      .getHolidays(this.currentUser.companyId)
      .subscribe((h) => this.holidays.set(h));
  }

  async onAdd(): Promise<void> {
    if (this.form.invalid) return;
    const { name, date, recurring } = this.form.value;
    await this.calendarService.addHoliday({
      companyId: this.currentUser!.companyId,
      name: name!,
      date: format(date!, 'yyyy-MM-dd'),
      recurring: recurring ?? false,
    });
    this.snackBar.open('Holiday added', 'OK', { duration: 2000 });
    this.form.reset({ recurring: true });
  }

  async onDelete(id: string): Promise<void> {
    await this.calendarService.deleteHoliday(id);
    this.snackBar.open('Holiday removed', 'OK', { duration: 2000 });
  }
}
