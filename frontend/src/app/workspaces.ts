import type { RoleCode } from '../shared/api/types';

export type Workspace = 'requester' | 'technician' | 'supervisor' | 'admin';

export const workspaces: Record<Workspace, { role: RoleCode; label: string; path: string }> = {
  requester: { role: 'REQUESTER', label: 'Người yêu cầu', path: '/requester' },
  technician: { role: 'TECHNICIAN', label: 'Kỹ thuật viên', path: '/technician' },
  supervisor: { role: 'SUPERVISOR', label: 'Người điều phối', path: '/supervisor' },
  admin: { role: 'ADMIN', label: 'Quản trị hệ thống', path: '/admin' },
};

export const homePath = (roles: RoleCode[]): string =>
  (['admin', 'supervisor', 'technician', 'requester'] as Workspace[])
    .map((workspace) => workspaces[workspace])
    .find(({ role }) => roles.includes(role))?.path ?? '/login';

export const menu = [
  { path: '/requester/ai', label: 'Trợ lý AI', workspace: 'requester' },
  { path: '/requester', label: 'Trang chủ', workspace: 'requester' },
  { path: '/requester/assets', label: 'Tài sản của tôi', workspace: 'requester' },
  { path: '/requester/tickets', label: 'Yêu cầu của tôi', workspace: 'requester' },
  { path: '/requester/tickets/new', label: 'Tạo yêu cầu', workspace: 'requester' },
  { path: '/technician', label: 'Trang chủ kỹ thuật', workspace: 'technician' },
  { path: '/technician/tickets', label: 'Việc được giao', workspace: 'technician' },
  { path: '/technician/assets/dashboard', label: 'Tổng quan tài sản', workspace: 'technician' },
  { path: '/technician/assets', label: 'Kho tài sản', workspace: 'technician' },
  { path: '/technician/asset-maintenance', label: 'Bảo trì tài sản', workspace: 'technician' },
  { path: '/technician/asset-history', label: 'Lịch sử tài sản', workspace: 'technician' },
  { path: '/supervisor', label: 'Tổng quan điều phối', workspace: 'supervisor' },
  { path: '/supervisor/queue', label: 'Hàng đợi Ticket', workspace: 'supervisor' },
  { path: '/supervisor/assignments', label: 'Phân công', workspace: 'supervisor' },
  { path: '/supervisor/dashboard', label: 'Tất cả Ticket', workspace: 'supervisor' },
  { path: '/supervisor/assets/dashboard', label: 'Tổng quan tài sản', workspace: 'supervisor' },
  { path: '/supervisor/assets', label: 'Kho tài sản', workspace: 'supervisor' },
  { path: '/supervisor/assets/assignments', label: 'Theo dõi phân công tài sản', workspace: 'supervisor' },
  { path: '/supervisor/asset-maintenance', label: 'Bảo trì tài sản', workspace: 'supervisor' },
  { path: '/supervisor/asset-history', label: 'Lịch sử tài sản', workspace: 'supervisor' },
  { path: '/admin', label: 'Tài khoản & Vai trò', workspace: 'admin' },
  { path: '/admin/categories', label: 'Danh mục sự cố', workspace: 'admin' },
  { path: '/admin/sla', label: 'Chính sách SLA', workspace: 'admin' },
  { path: '/admin/assets/dashboard', label: 'Tổng quan tài sản', workspace: 'admin' },
  { path: '/admin/assets', label: 'Kho tài sản', workspace: 'admin' },
  { path: '/admin/assets/assignments', label: 'Phân công & hoàn trả', workspace: 'admin' },
  { path: '/admin/asset-maintenance', label: 'Bảo trì tài sản', workspace: 'admin' },
  { path: '/admin/asset-history', label: 'Lịch sử tài sản', workspace: 'admin' },
  { path: '/admin/asset-categories', label: 'Danh mục tài sản', workspace: 'admin' },
] as const satisfies ReadonlyArray<{ path: string; label: string; workspace: Workspace }>;
