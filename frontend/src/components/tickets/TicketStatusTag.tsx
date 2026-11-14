import { Tag } from 'antd';
import type { TicketStatus } from '../../types/ticket';
import { STATUS_METADATA } from './ticketMetadata';

interface TicketStatusTagProps {
  status: TicketStatus;
}

export default function TicketStatusTag({ status }: TicketStatusTagProps) {
  const meta = STATUS_METADATA[status];

  return <Tag color={meta.color}>{meta.label}</Tag>;
}
