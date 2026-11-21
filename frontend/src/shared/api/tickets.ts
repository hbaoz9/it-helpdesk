import { apiRequest } from './client';
import type {
  Category,
  ImpactLevel,
  SupervisorDashboardSummary,
  SupervisorTechnicianSummary,
  TechnicianTicketSummary,
  TicketActivity,
  TicketPriority,
  TicketRecord,
  TicketSlaSnapshot,
  TicketStatus,
  UrgencyLevel,
} from './types';

export interface CreateTicketInput {
  title: string;
  description: string;
  categoryId: string;
  impact: ImpactLevel;
  urgency: UrgencyLevel;
}

export interface TicketFilters {
  scope?: 'requested' | 'assigned';
  categoryId?: string;
  status?: TicketStatus;
  priority?: TicketRecord['priority'];
  search?: string;
  page?: number;
  limit?: number;
}

export interface TriageTicketInput {
  version: number;
  categoryId?: string;
  impact?: ImpactLevel;
  urgency?: UrgencyLevel;
  priority?: TicketPriority;
  reason?: string;
}

export interface AssignTicketInput {
  version: number;
  assigneeId: string;
  reason?: string;
}

export interface OverridePriorityInput {
  version: number;
  priority: TicketPriority;
  reason: string;
}

export function getCategories(): Promise<Category[]> {
  return apiRequest('/categories');
}

export function getTickets(filters: TicketFilters = {}): Promise<TicketRecord[]> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const query = params.size > 0 ? `?${params.toString()}` : '';
  return apiRequest(`/tickets${query}`);
}

export function getTicket(id: string): Promise<TicketRecord> {
  return apiRequest(`/tickets/${encodeURIComponent(id)}`);
}

export function getAssignedTicket(id: string): Promise<TicketRecord> {
  return apiRequest(`/tickets/${encodeURIComponent(id)}?scope=assigned`);
}

export function getTechnicianSummary(): Promise<TechnicianTicketSummary> {
  return apiRequest('/tickets/technician/summary');
}

export function getTechnicianTicketActivity(id: string): Promise<TicketActivity[]> {
  return apiRequest(`/tickets/${encodeURIComponent(id)}/technician-activity`);
}

export function startAssignedTicket(id: string, version: number): Promise<TicketRecord> {
  return apiRequest(`/tickets/${encodeURIComponent(id)}/start`, {
    method: 'POST', body: JSON.stringify({ version }),
  });
}

export function addTechnicianComment(id: string, content: string, version: number): Promise<TicketActivity> {
  return apiRequest(`/tickets/${encodeURIComponent(id)}/technician-comments`, {
    method: 'POST', body: JSON.stringify({ content, version }),
  });
}

export function addTechnicianNote(id: string, content: string, version: number): Promise<TicketActivity> {
  return apiRequest(`/tickets/${encodeURIComponent(id)}/notes`, {
    method: 'POST', body: JSON.stringify({ content, version }),
  });
}

export function requestTicketInformation(id: string, content: string, version: number): Promise<TicketRecord> {
  return apiRequest(`/tickets/${encodeURIComponent(id)}/request-information`, {
    method: 'POST', body: JSON.stringify({ content, version }),
  });
}

export function resolveAssignedTicket(id: string, resolution: string, version: number): Promise<TicketRecord> {
  return apiRequest(`/tickets/${encodeURIComponent(id)}/resolve`, {
    method: 'POST', body: JSON.stringify({ content: resolution, version }),
  });
}

export function getRequesterTicket(id: string): Promise<TicketRecord> {
  return apiRequest(`/tickets/${encodeURIComponent(id)}?scope=requested`);
}

export function getRequesterTicketCount(filters: TicketFilters = {}): Promise<number> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const query = params.size > 0 ? `?${params.toString()}` : '';
  return apiRequest<{ total: number }>(`/tickets/my/count${query}`).then(({ total }) => total);
}

export function createTicket(input: CreateTicketInput): Promise<TicketRecord> {
  return apiRequest('/tickets', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function getRequesterTicketActivity(id: string): Promise<TicketActivity[]> {
  return apiRequest(`/tickets/${encodeURIComponent(id)}/activity`);
}

export function addRequesterTicketComment(id: string, content: string, version: number): Promise<TicketActivity> {
  return apiRequest(`/tickets/${encodeURIComponent(id)}/comments`, {
    method: 'POST', body: JSON.stringify({ content, version }),
  });
}

export function closeRequesterTicket(id: string, version: number): Promise<TicketRecord> {
  return apiRequest(`/tickets/${encodeURIComponent(id)}/close`, {
    method: 'POST', body: JSON.stringify({ version }),
  });
}

export function reopenRequesterTicket(id: string, version: number, reason: string): Promise<TicketRecord> {
  return apiRequest(`/tickets/${encodeURIComponent(id)}/reopen`, {
    method: 'POST', body: JSON.stringify({ version, reason }),
  });
}

/* Supervisor Workflow, Dashboard & SLA APIs */

export function getSupervisorDashboard(): Promise<SupervisorDashboardSummary> {
  return apiRequest('/tickets/supervisor/dashboard');
}

export function getSupervisorTechnicians(): Promise<SupervisorTechnicianSummary[]> {
  return apiRequest('/tickets/supervisor/technicians');
}

export function getTicketSla(id: string): Promise<TicketSlaSnapshot> {
  return apiRequest(`/tickets/${encodeURIComponent(id)}/sla`);
}

export function getSupervisorTicketEvents(id: string): Promise<TicketActivity[]> {
  return apiRequest(`/tickets/${encodeURIComponent(id)}/events`);
}

export function triageTicket(id: string, input: TriageTicketInput): Promise<TicketRecord> {
  return apiRequest(`/tickets/${encodeURIComponent(id)}/triage`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function assignTicket(id: string, input: AssignTicketInput): Promise<TicketRecord> {
  return apiRequest(`/tickets/${encodeURIComponent(id)}/assign`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function rejectTicket(id: string, version: number, reason: string): Promise<TicketRecord> {
  return apiRequest(`/tickets/${encodeURIComponent(id)}/reject`, {
    method: 'POST',
    body: JSON.stringify({ version, reason }),
  });
}

export function overrideTicketPriority(id: string, input: OverridePriorityInput): Promise<TicketRecord> {
  return apiRequest(`/tickets/${encodeURIComponent(id)}/override-priority`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
