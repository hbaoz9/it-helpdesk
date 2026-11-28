import { apiRequest } from './client';
import type {
  AssetAssignmentRecord,
  AssetCategoryRecord,
  AssetCondition,
  AssetDashboardSummary,
  AssetHistoryRecord,
  AssetListResult,
  AssetMaintenanceRecord,
  AssetMaintenanceType,
  AssetRecord,
  AssetRecordReference,
  AssetStatus,
  AssetTicketSearchRecord,
  MaintenanceStatus,
} from './types';

export interface AssetFilters {
  search?: string;
  categoryId?: string;
  status?: AssetStatus;
  page?: number;
  limit?: number;
}

export interface AssetInput {
  code?: string;
  sharedReportable?: boolean;
  name: string;
  categoryId: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  condition?: AssetCondition;
  location?: string;
  purchaseDate?: string;
  warrantyExpiration?: string;
  description?: string;
}

type RawRecord = Record<string, unknown>;

const asRecord = (value: unknown): RawRecord =>
  value && typeof value === 'object' ? value as RawRecord : {};

const optionalString = (value: unknown): string | null =>
  typeof value === 'string' ? value : null;

function toAssetRecord(value: unknown): AssetRecord {
  const raw = asRecord(value);
  const category = asRecord(raw.category);
  const assignments = Array.isArray(raw.assignments) ? raw.assignments : [];
  const current = asRecord(assignments[0]);
  const currentUser = asRecord(current.user);
  const counts = asRecord(raw._count);
  return {
    id: String(raw.id ?? ''),
    sharedReportable: raw.sharedReportable === true,
    code: String(raw.assetTag ?? raw.code ?? '-'),
    name: String(raw.name ?? ''),
    categoryId: String(raw.categoryId ?? category.id ?? ''),
    category: {
      id: String(category.id ?? raw.categoryId ?? ''),
      name: String(category.name ?? ''),
      code: String(category.code ?? ''),
    },
    brand: optionalString(raw.manufacturer ?? raw.brand),
    model: optionalString(raw.model),
    serialNumber: optionalString(raw.serialNumber),
    condition: optionalString(raw.condition) as AssetCondition | null,
    location: optionalString(raw.location),
    purchaseDate: optionalString(raw.purchaseDate),
    warrantyExpiration: optionalString(raw.warrantyExpires ?? raw.warrantyExpiration),
    status: raw.status as AssetStatus,
    description: optionalString(raw.notes ?? raw.description),
    active: raw.deletedAt == null && raw.active !== false,
    createdAt: String(raw.createdAt ?? ''),
    updatedAt: String(raw.updatedAt ?? ''),
    currentAssignment: current.id ? {
      id: String(current.id),
      assignedUserId: String(current.userId ?? currentUser.id ?? ''),
      assignedUser: {
        id: String(currentUser.id ?? ''),
        fullName: String(currentUser.fullName ?? ''),
        email: String(currentUser.email ?? ''),
      },
      assignedDate: String(current.assignedAt ?? current.assignedDate ?? ''),
    } : null,
    assignmentCount: typeof counts.assignments === 'number' ? counts.assignments : undefined,
    maintenanceCount: typeof counts.maintenance === 'number' ? counts.maintenance : undefined,
    ticketCount: typeof counts.tickets === 'number' ? counts.tickets : undefined,
  };
}

function toAssetReference(value: unknown): AssetRecordReference {
  const raw = asRecord(value);
  const category = asRecord(raw.category);
  return {
    id: String(raw.id ?? ''),
    code: String(raw.assetTag ?? raw.code ?? ''),
    name: String(raw.name ?? ''),
    ...(typeof category.name === 'string' ? { category: { name: category.name } } : {}),
  };
}

function toCategoryRecord(value: unknown): AssetCategoryRecord {
  const raw = asRecord(value);
  const count = asRecord(raw._count);
  return {
    id: String(raw.id ?? ''),
    name: String(raw.name ?? ''),
    description: optionalString(raw.description),
    code: typeof raw.code === 'string' ? raw.code : '',
    active: raw.active !== false,
    assetCount: typeof raw.assetCount === 'number'
      ? raw.assetCount
      : typeof count.assets === 'number' ? count.assets : 0,
  };
}

function toAssignmentRecord(value: unknown): AssetAssignmentRecord {
  const raw = asRecord(value);
  const user = asRecord(raw.user ?? raw.assignedUser);
  const assignedBy = asRecord(raw.assignedBy);
  const returnedBy = asRecord(raw.returnedBy);
  const asset = raw.asset ? toAssetReference(raw.asset) : undefined;
  return {
    id: String(raw.id ?? ''),
    assetId: String(raw.assetId ?? asset?.id ?? ''),
    assignedUser: {
      id: String(user.id ?? ''),
      fullName: String(user.fullName ?? ''),
      email: String(user.email ?? ''),
    },
    assignedBy: raw.assignedBy ? {
      id: String(assignedBy.id ?? ''),
      fullName: String(assignedBy.fullName ?? ''),
    } : null,
    returnedBy: raw.returnedBy ? {
      id: String(returnedBy.id ?? ''),
      fullName: String(returnedBy.fullName ?? ''),
    } : null,
    assignedDate: String(raw.assignedAt ?? raw.assignedDate ?? ''),
    returnDate: optionalString(raw.returnedAt ?? raw.returnDate),
    status: raw.returnedAt || raw.returnDate ? 'RETURNED' : 'ACTIVE',
    notes: optionalString(raw.notes),
    returnNotes: optionalString(raw.returnNotes),
    conditionAtAssignment: optionalString(raw.conditionAtAssignment) as AssetCondition | null,
    conditionAtReturn: optionalString(raw.conditionAtReturn) as AssetCondition | null,
    asset,
  };
}

function toMaintenanceRecord(value: unknown): AssetMaintenanceRecord {
  const raw = asRecord(value);
  const creator = asRecord(raw.createdBy ?? raw.technician);
  const asset = raw.asset ? toAssetReference(raw.asset) : undefined;
  return {
    id: String(raw.id ?? ''),
    assetId: String(raw.assetId ?? asset?.id ?? ''),
    type: raw.type as AssetMaintenanceType,
    title: String(raw.title ?? ''),
    description: optionalString(raw.description),
    diagnosis: optionalString(raw.diagnosis),
    resolution: optionalString(raw.resolution),
    notes: optionalString(raw.notes),
    provider: optionalString(raw.provider),
    cost: typeof raw.cost === 'number' ? raw.cost : null,
    scheduledAt: optionalString(raw.scheduledAt),
    startDate: String(raw.startedAt ?? raw.startDate ?? raw.scheduledAt ?? raw.createdAt ?? ''),
    completionDate: optionalString(raw.completedAt ?? raw.completionDate),
    status: raw.status as MaintenanceStatus,
    createdBy: raw.createdBy ? {
      id: String(creator.id ?? ''),
      fullName: String(creator.fullName ?? ''),
    } : null,
    asset,
  };
}

function toHistoryRecord(value: unknown): AssetHistoryRecord {
  const raw = asRecord(value);
  const actor = asRecord(raw.actor);
  const details = raw.details !== undefined ? raw.details : raw.description ?? null;
  const description = typeof raw.description === 'string'
    ? raw.description
    : typeof details === 'string'
      ? details
      : details === null ? '' : JSON.stringify(details) ?? '';
  return {
    id: String(raw.id ?? ''),
    assetId: String(raw.assetId ?? ''),
    type: String(raw.action ?? raw.type ?? ''),
    description,
    details,
    notes: optionalString(raw.notes),
    actor: raw.actor ? { id: String(actor.id ?? ''), fullName: String(actor.fullName ?? '') } : null,
    createdAt: String(raw.createdAt ?? ''),
    asset: raw.asset ? toAssetReference(raw.asset) : undefined,
  };
}

async function getAllRecords<T>(path: string, keys: string[], map: (item: unknown) => T): Promise<T[]> {
  const items: T[] = [];
  let page = 1;
  while (true) {
    const params = new URLSearchParams({ page: String(page), limit: '100' });
    const response = await apiRequest<unknown>(`${path}?${params}`);
    const record = asRecord(response);
    const pageItems = Array.isArray(response)
      ? response
      : keys.map((key) => record[key]).find(Array.isArray) as unknown[] | undefined;
    if (!pageItems || pageItems.length === 0) return items;
    items.push(...pageItems.map(map));
    const total = typeof record.total === 'number' ? record.total : items.length;
    if (items.length >= total || pageItems.length < 100) break;
    page += 1;
  }
  return items;
}

export function getAssetDashboard(): Promise<AssetDashboardSummary> {
  return apiRequest('/assets/dashboard');
}

export function getAssets(filters: AssetFilters = {}): Promise<AssetListResult> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const query = params.size ? `?${params}` : '';
  return apiRequest<{ items: unknown[]; total: number; page: number; limit: number }>(`/assets${query}`)
    .then(({ items, total, page, limit }) => ({
      items: items.map(toAssetRecord),
      total,
      page,
      limit,
    }));
}

export async function getAllAssets(): Promise<AssetRecord[]> {
  const items: AssetRecord[] = [];
  let page = 1;
  while (true) {
    const result = await getAssets({ page, limit: 100 });
    items.push(...result.items);
    if (items.length >= result.total || result.items.length < 100) break;
    page += 1;
  }
  return items;
}

export function getAsset(id: string): Promise<AssetRecord> {
  return apiRequest(`/assets/${encodeURIComponent(id)}`).then(toAssetRecord);
}

export function getMyAssignedAssets(): Promise<AssetRecord[]> {
  return apiRequest<unknown[]>('/assets/my-assigned').then((items) => items.map(toAssetRecord));
}

export function searchAssetsForTicket(search = ''): Promise<AssetTicketSearchRecord[]> {
  const query = search ? `?search=${encodeURIComponent(search)}` : '';
  return apiRequest<unknown[]>(`/assets/search-for-ticket${query}`).then((items) => items.map((item) => {
    const raw = asRecord(item);
    const category = asRecord(raw.category);
    return {
      id: String(raw.id ?? ''),
      code: String(raw.assetTag ?? raw.code ?? ''),
      name: String(raw.name ?? ''),
      category: { id: String(category.id ?? ''), name: String(category.name ?? ''), code: String(category.code ?? '') },
      location: optionalString(raw.location),
      status: raw.status as AssetStatus,
    };
  }));
}

function toApiAssetInput(input: Partial<AssetInput>): RawRecord {
  return {
    ...(input.code !== undefined ? { assetTag: input.code } : {}),
    ...(input.sharedReportable !== undefined ? { sharedReportable: input.sharedReportable } : {}),
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
    ...(input.brand !== undefined ? { manufacturer: input.brand } : {}),
    ...(input.model !== undefined ? { model: input.model } : {}),
    ...(input.serialNumber !== undefined ? { serialNumber: input.serialNumber } : {}),
    ...(input.condition !== undefined ? { condition: input.condition } : {}),
    ...(input.location !== undefined ? { location: input.location } : {}),
    ...(input.purchaseDate !== undefined ? { purchaseDate: input.purchaseDate || null } : {}),
    ...(input.warrantyExpiration !== undefined ? { warrantyExpires: input.warrantyExpiration || null } : {}),
    ...(input.description !== undefined ? { notes: input.description } : {}),
  };
}

export function createAsset(input: AssetInput): Promise<AssetRecord> {
  return apiRequest('/assets', { method: 'POST', body: JSON.stringify(toApiAssetInput(input)) })
    .then(toAssetRecord);
}

export function updateAsset(id: string, input: Partial<AssetInput>): Promise<AssetRecord> {
  return apiRequest(`/assets/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(toApiAssetInput(input)),
  }).then(toAssetRecord);
}

export function updateAssetStatus(id: string, status: AssetStatus): Promise<AssetRecord> {
  return apiRequest(`/assets/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  }).then(toAssetRecord);
}

export function getAssetCategories(): Promise<AssetCategoryRecord[]> {
  return apiRequest<unknown[]>('/assets/categories').then((items) => items.map(toCategoryRecord));
}

export function createAssetCategory(input: { name: string; description?: string }): Promise<AssetCategoryRecord> {
  return apiRequest('/assets/categories', { method: 'POST', body: JSON.stringify(input) }).then(toCategoryRecord);
}

export function updateAssetCategory(id: string, input: { name?: string; description?: string | null; active?: boolean }): Promise<AssetCategoryRecord> {
  return apiRequest(`/assets/categories/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  }).then(toCategoryRecord);
}

export function getAssetAssignments(id: string): Promise<AssetAssignmentRecord[]> {
  return apiRequest<unknown[]>(`/assets/${encodeURIComponent(id)}/assignments`).then((items) => items.map(toAssignmentRecord));
}

export function getAllAssetAssignments(): Promise<AssetAssignmentRecord[]> {
  return getAllRecords('/assets/assignments', ['items', 'assignments'], toAssignmentRecord);
}

export function assignAsset(id: string, input: { userId: string; notes?: string; conditionAtAssignment?: AssetCondition }): Promise<AssetAssignmentRecord> {
  return apiRequest(`/assets/${encodeURIComponent(id)}/assign`, {
    method: 'POST',
    body: JSON.stringify(input),
  }).then(toAssignmentRecord);
}

export function returnAsset(id: string, input: { notes?: string; conditionAtReturn?: AssetCondition }): Promise<AssetAssignmentRecord> {
  return apiRequest(`/assets/${encodeURIComponent(id)}/return`, {
    method: 'POST',
    body: JSON.stringify(input),
  }).then(toAssignmentRecord);
}

export function getAssetMaintenance(id: string): Promise<AssetMaintenanceRecord[]> {
  return apiRequest<unknown[]>(`/assets/${encodeURIComponent(id)}/maintenance`).then((items) => items.map(toMaintenanceRecord));
}

export function getAllAssetMaintenance(): Promise<AssetMaintenanceRecord[]> {
  return getAllRecords('/assets/maintenance', ['items', 'maintenance'], toMaintenanceRecord);
}

export function createAssetMaintenance(id: string, input: {
  type: AssetMaintenanceType;
  title: string;
  description?: string;
  diagnosis?: string;
  resolution?: string;
  notes?: string;
  provider?: string;
  cost?: number;
  scheduledAt?: string;
}): Promise<AssetMaintenanceRecord> {
  return apiRequest(`/assets/${encodeURIComponent(id)}/maintenance`, {
    method: 'POST',
    body: JSON.stringify(input),
  }).then(toMaintenanceRecord);
}

export function updateAssetMaintenance(id: string, maintenanceId: string, input: {
  status: MaintenanceStatus;
  description?: string;
  diagnosis?: string;
  resolution?: string;
  notes?: string;
  provider?: string;
  cost?: number;
  scheduledAt?: string;
}): Promise<AssetMaintenanceRecord> {
  return apiRequest(`/assets/${encodeURIComponent(id)}/maintenance/${encodeURIComponent(maintenanceId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  }).then(toMaintenanceRecord);
}

export function getAssetHistory(id: string): Promise<AssetHistoryRecord[]> {
  return apiRequest<unknown[]>(`/assets/${encodeURIComponent(id)}/history`).then((items) => items.map(toHistoryRecord));
}

export function getAllAssetHistory(): Promise<AssetHistoryRecord[]> {
  return getAllRecords('/assets/history', ['items', 'history'], toHistoryRecord);
}
