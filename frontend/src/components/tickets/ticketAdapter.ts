import type { TicketRecord } from '../../api/types';
import type { Ticket } from '../../types/ticket';
import { UNASSIGNED_ASSIGNEE } from './ticketMetadata';

export function toTicketRow(record: TicketRecord): Ticket {
  return {
    id: record.id,
    code: record.code,
    title: record.title,
    category: record.category.name,
    priority: record.priority,
    status: record.status,
    assignee: record.assignee?.fullName ?? UNASSIGNED_ASSIGNEE,
    createdAt: record.createdAt,
  };
}
