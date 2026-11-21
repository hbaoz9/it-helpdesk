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
export type SlaHealthStatus = 'MET' | 'ON_TRACK' | 'AT_RISK' | 'BREACHED';

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
  impact: ImpactLevel;
  urgency: UrgencyLevel;
  priority: TicketPriority;
  status: TicketStatus;
  category: { id: string; name: string };
  requester: { id: string; fullName: string };
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

export interface TicketSlaSnapshot {
  ticketId: string;
  priority: TicketPriority;
  status: TicketStatus;
  createdAt: string;
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
  };
  workloadByTechnician: SupervisorTechnicianSummary[];
}
