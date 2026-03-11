export type MemberRole = 'owner' | 'admin' | 'manager' | 'member';

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: MemberRole;
  teamId: string;
  capacityPoints: number;
  timezone: string;
  isActive: boolean;
  createdAt: any;
  updatedAt: any;
  onlineState?: 'online' | 'away' | 'offline';
  lastSeenAt?: any;
}

export interface RoleOption {
  value: MemberRole;
  label: string;
  description: string;
}

export const MEMBER_ROLES: RoleOption[] = [
  { value: 'owner', label: 'Owner', description: 'Full access to everything' },
  { value: 'admin', label: 'Admin', description: 'Manage members & settings' },
  {
    value: 'manager',
    label: 'Manager',
    description: 'Manage planning & sprints',
  },
  { value: 'member', label: 'Member', description: 'Read access only' },
];

export const TIMEZONES: { value: string; label: string }[] = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
  { value: 'Europe/Kiev', label: 'Kyiv (EET/EEST)' },
  { value: 'Europe/Moscow', label: 'Moscow (MSK)' },
  { value: 'Asia/Istanbul', label: 'Istanbul (TRT)' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)' },
  { value: 'Asia/Kolkata', label: 'India (IST)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
  { value: 'Pacific/Auckland', label: 'Auckland (NZST/NZDT)' },
];
