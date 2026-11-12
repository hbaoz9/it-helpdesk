import { Tag } from 'antd';
import type { TicketPriority } from '../../types/ticket';
import { PRIORITY_METADATA } from './ticketMetadata';

interface TicketPriorityTagProps {
  priority: TicketPriority;
}

export default function TicketPriorityTag({
  priority,
}: TicketPriorityTagProps) {
  const meta = PRIORITY_METADATA[priority];

  return <Tag color={meta.color}>{meta.label}</Tag>;
}
