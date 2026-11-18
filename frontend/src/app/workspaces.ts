import type { RoleCode } from '../shared/api/types';

export type Workspace = 'requester' | 'technician' | 'supervisor' | 'admin';

export const workspaces: Record<Workspace, { role: RoleCode; label: string; path: string }> = {
  requester: { role: 'REQUESTER', label: 'Requester', path: '/requester' },
  technician: { role: 'TECHNICIAN', label: 'Technician', path: '/technician' },
  supervisor: { role: 'SUPERVISOR', label: 'Supervisor', path: '/supervisor' },
  admin: { role: 'ADMIN', label: 'Administrator', path: '/admin' },
};

export const homePath = (roles: RoleCode[]): string =>
  (['admin', 'supervisor', 'technician', 'requester'] as Workspace[])
    .map((workspace) => workspaces[workspace])
    .find(({ role }) => roles.includes(role))?.path ?? '/login';

export const menu = [
  { path: '/requester', label: 'Tổng quan', workspace: 'requester' },
  { path: '/requester/tickets', label: 'Ticket của tôi', workspace: 'requester' },
  { path: '/requester/tickets/new', label: 'Tạo yêu cầu', workspace: 'requester' },
  { path: '/technician', label: 'Tổng quan', workspace: 'technician' },
  { path: '/technician/tickets', label: 'Ticket được giao', workspace: 'technician' },
  { path: '/supervisor', label: 'Tổng quan', workspace: 'supervisor' },
  { path: '/supervisor/queue', label: 'Hàng đợi Ticket', workspace: 'supervisor' },
  { path: '/supervisor/assignments', label: 'Phân công', workspace: 'supervisor' },
  { path: '/supervisor/dashboard', label: 'Dashboard', workspace: 'supervisor' },
  { path: '/admin', label: 'Tổng quan', workspace: 'admin' },
] as const satisfies ReadonlyArray<{ path: string; label: string; workspace: Workspace }>;
