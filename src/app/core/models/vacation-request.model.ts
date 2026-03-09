export type VacationRequestStatus = 'pending' | 'approved' | 'rejected';

export interface VacationRequest {
  id: string;
  userId: string;
  userName: string;
  teamId: string;
  managerId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  workingDays: number;
  status: VacationRequestStatus;
  note?: string;
  createdAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
  rejectReason?: string;
}
