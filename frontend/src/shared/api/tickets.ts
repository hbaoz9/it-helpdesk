import { apiRequest } from './client';
import type {
  Category,
  ImpactLevel,
  TicketRecord,
  TicketActivity,
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
  scope?: 'requested';
  categoryId?: string;
  status?: TicketStatus;
  priority?: TicketRecord['priority'];
  search?: string;
  page?: number;
  limit?: number;
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
