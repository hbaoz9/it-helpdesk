import { apiRequest } from './client';
import type {
  Category,
  ImpactLevel,
  TicketRecord,
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
  status?: TicketStatus;
  priority?: TicketRecord['priority'];
  search?: string;
}

export function getCategories(): Promise<Category[]> {
  return apiRequest('/categories');
}

export function getTickets(filters: TicketFilters = {}): Promise<TicketRecord[]> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  const query = params.size > 0 ? `?${params.toString()}` : '';
  return apiRequest(`/tickets${query}`);
}

export function getTicket(id: string): Promise<TicketRecord> {
  return apiRequest(`/tickets/${encodeURIComponent(id)}`);
}

export function createTicket(input: CreateTicketInput): Promise<TicketRecord> {
  return apiRequest('/tickets', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
