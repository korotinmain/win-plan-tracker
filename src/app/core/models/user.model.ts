export type UserRole = 'admin' | 'manager' | 'employee';

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  teamId: string;
  photoURL?: string;
  createdAt: Date;
}
