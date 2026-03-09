import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { VacationService } from '../../../core/services/vacation.service';
import { AuthService } from '../../../core/services/auth.service';
import { VacationRequest } from '../../../core/models/vacation-request.model';

@Component({
  selector: 'app-my-vacations',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatChipsModule,
  ],
  templateUrl: './my-vacations.component.html',
  styleUrls: ['./my-vacations.component.scss'],
})
export class MyVacationsComponent {
  private authService = inject(AuthService);
  private vacationService = inject(VacationService);

  currentUser = this.authService.currentUser;
  requests = signal<VacationRequest[]>([]);
  loading = signal(true);

  constructor() {
    const uid = this.currentUser?.uid ?? '';
    if (uid) {
      this.vacationService.getUserRequests(uid).subscribe((reqs) => {
        this.requests.set(reqs);
        this.loading.set(false);
      });
    } else {
      this.loading.set(false);
    }
  }

  statusColor(status: string): string {
    return (
      ({ approved: '#d1fae5', pending: '#fef3c7', rejected: '#fee2e2' } as any)[
        status
      ] ?? '#f1f5f9'
    );
  }

  statusTextColor(status: string): string {
    return (
      ({ approved: '#065f46', pending: '#92400e', rejected: '#991b1b' } as any)[
        status
      ] ?? '#475569'
    );
  }
}
