export type RoleCode = 'REQUESTER' | 'TECHNICIAN' | 'SUPERVISOR' | 'ADMIN';
export type TicketStatus =
  | 'NEW'
  | 'TRIAGED'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'WAITING_REQUESTER'
  | 'RESOLVED'
  | 'CLOSED'
  | 'REJECTED';
export type TicketPriority = 'P1' | 'P2' | 'P3' | 'P4';
export type ImpactLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type UrgencyLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type SlaHealthStatus = 'MET' | 'ON_TRACK' | 'AT_RISK' | 'BREACHED' | 'EXCLUDED';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  roles: RoleCode[];
}

export interface Category {
  id: string;
  name: string;
  active: boolean;
}

export interface TicketRecord {
  id: string;
  code: string;
  type: 'INCIDENT' | 'SERVICE_REQUEST';
  title: string;
  description: string;
  assetId?: string | null;
  asset?: {
    id: string;
    assetTag: string;
    name: string;
    category: { id: string; name: string; code?: string };
    location: string | null;
    status: AssetStatus;
  } | null;
  impact: ImpactLevel;
  urgency: UrgencyLevel;
  priority: TicketPriority;
  status: TicketStatus;
  category: { id: string; name: string };
  requester: { id: string; fullName: string; email?: string };
  assignee: { id: string; fullName: string } | null;
  createdAt: string;
  updatedAt: string;
  resolutionNote: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  version: number;
}

export interface TicketActivity {
  id: string;
  type: 'STATUS' | 'COMMENT';
  visibility?: 'PUBLIC' | 'INTERNAL';
  content: string | null;
  fromStatus: TicketStatus | null;
  toStatus: TicketStatus | null;
  createdAt: string;
  actor: { id: string; fullName: string } | null;
}

export interface AdminUserRecord {
  id: string;
  email: string;
  fullName: string;
  active: boolean;
  roles: RoleCode[];
  createdAt: string;
  updatedAt: string;
}

export interface AdminCategoryRecord {
  id: string;
  name: string;
  active: boolean;
  ticketCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminSlaPolicyRecord {
  id: string;
  priority: TicketPriority;
  responseMinutes: number;
  resolutionMinutes: number;
  revision: number;
  active: boolean;
  updatedAt: string;
}

export interface TicketSlaSnapshot {
  ticketId: string;
  priority: TicketPriority;
  status: TicketStatus;
  createdAt: string;
  deadlineBasis: 'AT_TICKET_CREATION';
  policyPriority: TicketPriority | null;
  policyRevision: number;
  responseTargetMinutes: number;
  resolutionTargetMinutes: number;
  responseDueAt: string;
  resolutionDueAt: string;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  responseStatus: SlaHealthStatus;
  resolutionStatus: SlaHealthStatus;
  overallStatus: SlaHealthStatus;
}

export interface SupervisorTechnicianSummary {
  id: string;
  fullName: string;
  email: string;
  activeAssignedCount: number;
  assignedCount: number;
  inProgressCount: number;
  waitingRequesterCount: number;
  resolvedCount: number;
  closedCount: number;
}

export interface SupervisorDashboardSummary {
  totalTickets: number;
  unassignedCount: number;
  triageQueueCount: number;
  byStatus: Record<TicketStatus, number>;
  byPriority: Record<TicketPriority, number>;
  sla: {
    onTrack: number;
    atRisk: number;
    breached: number;
    met: number;
    excluded: number;
    unknown: number;
  };
  workloadByTechnician: SupervisorTechnicianSummary[];
}

export interface TechnicianTicketSummary {
  total: number;
  inProgress: number;
  waitingRequester: number;
  resolved: number;
  highPriority: number;
  requesterReplies: number;
}

export type AssetStatus =
  | 'AVAILABLE'
  | 'ASSIGNED'
  | 'UNDER_MAINTENANCE'
  | 'RETIRED'
  | 'DISPOSED'
  | 'LOST';

export type AssetCondition = 'NEW' | 'GOOD' | 'FAIR' | 'POOR' | 'DAMAGED';
export type MaintenanceStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type AssetMaintenanceType = 'REPAIR' | 'MAINTENANCE' | 'UPGRADE' | 'INSPECTION';

export interface AssetCategoryRecord {
  id: string;
  name: string;
  description?: string | null;
  code?: string;
  active: boolean;
  assetCount: number;
}

export interface AssetRecord {
  id: string;
  code: string;
  name: string;
  categoryId: string;
  category: { id: string; name: string; code: string };
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  condition: AssetCondition | null;
  location: string | null;
  purchaseDate: string | null;
  warrantyExpiration: string | null;
  status: AssetStatus;
  description: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  currentAssignment?: {
    id: string;
    assignedUserId: string;
    assignedUser: { id: string; fullName: string; email: string };
    assignedDate: string;
  } | null;
  assignmentCount?: number;
  maintenanceCount?: number;
  ticketCount?: number;
}

export interface AssetRecordReference {
  id: string;
  code: string;
  name: string;
  category?: { name: string };
}

export interface AssetListResult {
  items: AssetRecord[];
  total: number;
  page: number;
  limit: number;
}

export interface AssetTicketSearchRecord {
  id: string;
  code: string;
  name: string;
  category: { id: string; name: string; code: string };
  location: string | null;
  status: AssetStatus;
}

export interface AssetAssignmentRecord {
  id: string;
  assetId: string;
  assignedUser: { id: string; fullName: string; email: string };
  assignedBy: { id: string; fullName: string } | null;
  assignedDate: string;
  returnDate: string | null;
  status: 'ACTIVE' | 'RETURNED';
  notes: string | null;
  returnNotes: string | null;
  conditionAtAssignment: AssetCondition | null;
  conditionAtReturn: AssetCondition | null;
  returnedBy?: { id: string; fullName: string } | null;
  asset?: AssetRecordReference;
}

export interface AssetMaintenanceRecord {
  id: string;
  assetId: string;
  type: AssetMaintenanceType;
  title: string;
  description: string | null;
  diagnosis: string | null;
  resolution: string | null;
  notes: string | null;
  provider: string | null;
  cost: number | null;
  scheduledAt: string | null;
  startDate: string;
  completionDate: string | null;
  status: MaintenanceStatus;
  createdBy: { id: string; fullName: string } | null;
  asset?: AssetRecordReference;
}

export interface AssetHistoryRecord {
  id: string;
  assetId: string;
  type: string;
  description: string;
  details: unknown;
  notes: string | null;
  actor: { id: string; fullName: string } | null;
  createdAt: string;
  asset?: AssetRecordReference;
}

export interface AssetDashboardSummary {
  total: number;
  byStatus: Record<string, number>;
  activeAssignments: number;
  activeMaintenance: number;
  activeCategories: number;
  categoryCounts: Array<{ id: string; name: string; count: number }>;
  attention: {
    poorCondition: number;
    damagedCondition: number;
    lostAssets: number;
    overdueMaintenance: number;
  };
  warranty: {
    expired: number;
    expiringWithin30Days: number;
    items: Array<{
      id: string;
      assetTag: string;
      name: string;
      warrantyExpires: string;
      category: { id: string; name: string };
    }>;
  };
}
