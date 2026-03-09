export interface Team {
  id: string;
  name: string;
  icon: string;
  companyId: string;
  managerId: string;
  memberIds: string[];
  createdAt: Date;
}
