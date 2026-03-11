export type NotificationEventType = 'vacation' | 'day-off';

export interface AppNotification {
  id: string;
  recipientUid: string;
  actorUid: string;
  actorName: string;
  actorPhotoURL?: string;
  teamId: string;
  type: NotificationEventType;
  startDate: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD (inclusive last day)
  note?: string;
  read: boolean;
  createdAt: Date;
}
