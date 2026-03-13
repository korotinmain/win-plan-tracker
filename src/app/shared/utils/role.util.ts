import { UserRole } from '../../core/models/user.model';

export interface RoleStyle {
  color: string;
  bg: string;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  manager: 'Manager',
  employee: 'Member',
};

export const ROLE_STYLES: Record<UserRole, RoleStyle> = {
  admin: { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  manager: { color: '#6366f1', bg: 'rgba(99,102,241,0.15)' },
  employee: { color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
};

export function getRoleLabel(role: string): string {
  return ROLE_LABELS[role as UserRole] ?? role;
}

export function getRoleColor(role: string): string {
  return ROLE_STYLES[role as UserRole]?.color ?? '#64748b';
}

export function getRoleBg(role: string): string {
  return ROLE_STYLES[role as UserRole]?.bg ?? 'rgba(100,116,139,0.15)';
}
