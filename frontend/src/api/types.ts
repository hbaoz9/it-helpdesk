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
  version: number;
}
