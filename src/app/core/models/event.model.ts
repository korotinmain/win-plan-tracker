export type EventType =
  | 'activity'
  | 'refinement'
  | 'planning'
  | 'sprint-review'
  | 'vacation'
  | 'holiday';
export type EventStatus = 'pending' | 'approved' | 'rejected';

export interface CalendarEvent {
  id: string;
  userId: string;
  teamId: string;
  type: EventType;
  date: string; // ISO date string YYYY-MM-DD
  endDate?: string; // For multi-day ranges (vacations)
  status: EventStatus;
  note?: string;
  createdBy: string;
  createdAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
}

export interface Holiday {
  id: string;
  companyId: string;
  name: string;
  date: string; // YYYY-MM-DD
  recurring: boolean; // yearly repeat
}

export interface DayCell {
  date: string; // YYYY-MM-DD
  userId: string;
  event: CalendarEvent | null;
  isWeekend: boolean;
  isHoliday: boolean;
  holidayName?: string;
}
