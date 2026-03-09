import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FormsModule } from '@angular/forms';
import { VacationService } from '../../../core/services/vacation.service';
import { AuthService } from '../../../core/services/auth.service';
import { VacationRequest } from '../../../core/models/vacation-request.model';

@Component({
  selector: 'app-vacation-approval',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './vacation-approval.component.html',
  styleUrls: ['./vacation-approval.component.scss'],
})
export class VacationApprovalComponent implements OnInit {
  private vacationService = inject(VacationService);
  private authService = inject(AuthService);
  private snackBar = inject(MatSnackBar);

  currentUser = this.authService.currentUser;
  pendingRequests = signal<VacationRequest[]>([]);
  loading = signal(true);
  rejectReasonMap = new Map<string, string>();

  ngOnInit(): void {
    if (!this.currentUser?.teamId) return;
    this.vacationService
      .getPendingRequests(this.currentUser.teamId)
      .subscribe((requests) => {
        this.pendingRequests.set(requests);
        this.loading.set(false);
      });
  }

  async approve(request: VacationRequest): Promise<void> {
    await this.vacationService.approveRequest(
      request.id,
      this.currentUser!.uid,
    );
    this.snackBar.open(`Approved ${request.userName}'s vacation`, 'OK', {
      duration: 3000,
    });
  }

  async reject(request: VacationRequest): Promise<void> {
    const reason = this.rejectReasonMap.get(request.id) ?? '';
    await this.vacationService.rejectRequest(
      request.id,
      this.currentUser!.uid,
      reason,
    );
    this.snackBar.open(`Rejected ${request.userName}'s request`, 'OK', {
      duration: 3000,
    });
  }

  getRejectReason(id: string): string {
    return this.rejectReasonMap.get(id) ?? '';
  }

  setRejectReason(id: string, value: string): void {
    this.rejectReasonMap.set(id, value);
  }
}
