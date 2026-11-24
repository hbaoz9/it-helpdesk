import { apiRequest } from './client';
import type {
  AdminAuditLogRecord,
  AdminCategoryRecord,
  AdminDeviceRecord,
  AdminRustdeskConfigRecord,
  AdminSlaPolicyRecord,
  AdminUserRecord,
  DeviceVerificationStatus,
  RoleCode,
} from './types';

export interface AdminUsersFilter {
  search?: string;
  role?: RoleCode | '';
  active?: 'true' | 'false' | '';
}

export interface CreateAdminUserPayload {
  email: string;
  fullName: string;
  password: string;
  roles: RoleCode[];
  active: boolean;
}

export interface UpdateAdminUserPayload {
  fullName?: string;
  roles?: RoleCode[];
  active?: boolean;
  password?: string;
}

export interface AdminCategoriesFilter {
  search?: string;
  active?: 'true' | 'false' | '';
}

export interface CreateAdminCategoryPayload {
  name: string;
  active: boolean;
}

export interface UpdateAdminCategoryPayload {
  name?: string;
  active?: boolean;
}

export interface UpdateSlaPolicyPayload {
  responseMinutes: number;
  resolutionMinutes: number;
  reason?: string;
}

function buildQuery(params: Record<string, string | undefined>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && value.trim().length > 0) {
      searchParams.set(key, value.trim());
    }
  }
  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
}

export async function getAdminUsers(
  filter: AdminUsersFilter = {},
): Promise<AdminUserRecord[]> {
  const query = buildQuery({
    search: filter.search,
    role: filter.role,
    active: filter.active,
  });
  const result = await apiRequest<{ users: AdminUserRecord[] }>(
    `/admin/users${query}`,
  );
  return result.users;
}

export async function createAdminUser(
  payload: CreateAdminUserPayload,
): Promise<AdminUserRecord> {
  const result = await apiRequest<{ user: AdminUserRecord }>('/admin/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return result.user;
}

export async function updateAdminUser(
  id: string,
  payload: UpdateAdminUserPayload,
): Promise<AdminUserRecord> {
  const result = await apiRequest<{ user: AdminUserRecord }>(
    `/admin/users/${id}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  );
  return result.user;
}

export async function getAdminCategories(
  filter: AdminCategoriesFilter = {},
): Promise<AdminCategoryRecord[]> {
  const query = buildQuery({
    search: filter.search,
    active: filter.active,
  });
  const result = await apiRequest<{ categories: AdminCategoryRecord[] }>(
    `/admin/categories${query}`,
  );
  return result.categories;
}

export async function createAdminCategory(
  payload: CreateAdminCategoryPayload,
): Promise<AdminCategoryRecord> {
  const result = await apiRequest<{ category: AdminCategoryRecord }>(
    '/admin/categories',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
  return result.category;
}

export async function updateAdminCategory(
  id: string,
  payload: UpdateAdminCategoryPayload,
): Promise<AdminCategoryRecord> {
  const result = await apiRequest<{ category: AdminCategoryRecord }>(
    `/admin/categories/${id}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  );
  return result.category;
}

export async function getAdminSlaPolicies(): Promise<AdminSlaPolicyRecord[]> {
  const result = await apiRequest<{ slaPolicies: AdminSlaPolicyRecord[] }>(
    '/admin/sla-policies',
  );
  return result.slaPolicies;
}

export async function updateAdminSlaPolicy(
  id: string,
  payload: UpdateSlaPolicyPayload,
): Promise<AdminSlaPolicyRecord> {
  const result = await apiRequest<{ slaPolicy: AdminSlaPolicyRecord }>(
    `/admin/sla-policies/${id}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  );
  return result.slaPolicy;
}

export interface AdminDevicesFilter {
  search?: string;
  active?: 'true' | 'false' | '';
  verificationStatus?: DeviceVerificationStatus | '';
}

export interface UpdateAdminDevicePayload {
  label?: string;
  active?: boolean;
  verificationStatus?: DeviceVerificationStatus;
  reason?: string;
}

export interface UpdateRustdeskConfigPayload {
  idServerHost: string;
  relayServerHost?: string | null;
  publicKey?: string | null;
  approvalTtlMinutes: number;
  clientGuideUrl?: string | null;
  enabled: boolean;
  reason?: string;
}

export async function getAdminDevices(
  filter: AdminDevicesFilter = {},
): Promise<AdminDeviceRecord[]> {
  const query = buildQuery({
    search: filter.search,
    active: filter.active,
    verificationStatus: filter.verificationStatus,
  });
  const result = await apiRequest<{ devices: AdminDeviceRecord[] }>(
    `/admin/devices${query}`,
  );
  return result.devices;
}

export async function updateAdminDevice(
  id: string,
  payload: UpdateAdminDevicePayload,
): Promise<AdminDeviceRecord> {
  const result = await apiRequest<{ device: AdminDeviceRecord }>(
    `/admin/devices/${id}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  );
  return result.device;
}

export async function getAdminRustdeskConfig(): Promise<AdminRustdeskConfigRecord> {
  const result = await apiRequest<{ config: AdminRustdeskConfigRecord }>(
    '/admin/rustdesk-config',
  );
  return result.config;
}

export async function updateAdminRustdeskConfig(
  payload: UpdateRustdeskConfigPayload,
): Promise<AdminRustdeskConfigRecord> {
  const result = await apiRequest<{ config: AdminRustdeskConfigRecord }>(
    '/admin/rustdesk-config',
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  );
  return result.config;
}

export async function getAdminAuditLogs(
  entityType?: string,
  limit = 50,
): Promise<AdminAuditLogRecord[]> {
  const query = buildQuery({
    entityType,
    limit: String(limit),
  });
  const result = await apiRequest<{ auditLogs: AdminAuditLogRecord[] }>(
    `/admin/audit-logs${query}`,
  );
  return result.auditLogs;
}
