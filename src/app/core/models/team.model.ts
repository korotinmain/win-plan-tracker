export interface Team {
  id: string;
  name: string;
  icon: string;
  managerId: string;
  memberIds: string[];
  createdAt: Date;
  holidayCountryCode?: string;
}
