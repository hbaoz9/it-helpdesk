import type { TicketPriority, TicketStatus } from '../../types/ticket';

export const STATUS_METADATA: Record<
  TicketStatus,
  { label: string; color: string }
> = {
  NEW: { label: 'NEW · Mới tạo', color: 'blue' },
  TRIAGED: { label: 'TRIAGED · Đã phân loại', color: 'cyan' },
  ASSIGNED: { label: 'ASSIGNED · Đã phân công', color: 'geekblue' },
  IN_PROGRESS: { label: 'IN_PROGRESS · Đang xử lý', color: 'processing' },
  WAITING_REQUESTER: {
    label: 'WAITING_REQUESTER · Chờ phản hồi',
    color: 'warning',
  },
  RESOLVED: { label: 'RESOLVED · Đã giải quyết', color: 'success' },
  CLOSED: { label: 'CLOSED · Đã đóng', color: 'default' },
  REJECTED: { label: 'REJECTED · Từ chối', color: 'error' },
};

export const PRIORITY_METADATA: Record<
  TicketPriority,
  { label: string; color: string }
> = {
  P1: { label: 'P1 – Critical', color: 'red' },
  P2: { label: 'P2 – High', color: 'volcano' },
  P3: { label: 'P3 – Medium', color: 'gold' },
  P4: { label: 'P4 – Low', color: 'green' },
};

export const UNASSIGNED_ASSIGNEE = 'Chưa phân công';
