
export type TicketStatus =
  | 'NEW'
  | 'TRIAGED'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'WAITING_REQUESTER'
  | 'RESOLVED'
  | 'CLOSED'
  | 'REJECTED';

// Mức ưu tiên minh họa, cần đối chiếu lại với tài liệu dự án.
export type TicketPriority = 'P1' | 'P2' | 'P3' | 'P4';

// Thông tin Ticket dùng chung cho Technician và Supervisor.
export interface Ticket {
  id: string;
  code: string;
  title: string;
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  assignee: string;
  createdAt: string;
}
