export type UserRole = 'admin' | 'manager' | 'employee';

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  teamId: string;
  photoURL?: string;
  createdAt: Date;
  /** Optional Jira connection metadata (stored in the user profile). */
  jira?: {
    /** True once Jira credentials have been stored. */
    configured: boolean;
    /** Simple boolean for UI state. */
    connected: boolean;
    /** When the connection was established. */
    connectedAt?: Date;
  } | null;
}
