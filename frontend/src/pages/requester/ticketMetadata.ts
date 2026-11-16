import type {
  ImpactLevel,
  TicketPriority,
  TicketStatus,
  UrgencyLevel,
} from '../../api/types';

export const STATUS_METADATA: Record<
  TicketStatus,
  { label: string; color: string; description: string }
> = {
  NEW: {
    label: 'NEW · Mới tạo',
    color: 'blue',
    description: 'Ticket vừa được gửi, đang chờ Supervisor phân loại (Triage).',
  },
  TRIAGED: {
    label: 'TRIAGED · Đã phân loại',
    color: 'cyan',
    description: 'Đã xác định mức ưu tiên, chờ phân công kỹ thuật viên.',
  },
  ASSIGNED: {
    label: 'ASSIGNED · Đã phân công',
    color: 'geekblue',
    description: 'Đã giao cho kỹ thuật viên phụ trách.',
  },
  IN_PROGRESS: {
    label: 'IN_PROGRESS · Đang xử lý',
    color: 'processing',
    description: 'Kỹ thuật viên đang kiểm tra và khắc phục sự cố.',
  },
  WAITING_REQUESTER: {
    label: 'WAITING_REQUESTER · Chờ phản hồi',
    color: 'warning',
    description: 'Kỹ thuật viên cần bạn cung cấp thêm thông tin để tiếp tục xử lý.',
  },
  RESOLVED: {
    label: 'RESOLVED · Đã giải quyết',
    color: 'success',
    description:
      'Kỹ thuật viên đã hoàn tất xử lý. Vui lòng xác nhận đóng hoặc mở lại trong 72 giờ.',
  },
  CLOSED: {
    label: 'CLOSED · Đã đóng',
    color: 'default',
    description: 'Yêu cầu đã hoàn tất và kết thúc vòng đời.',
  },
  REJECTED: {
    label: 'REJECTED · Từ chối',
    color: 'error',
    description: 'Yêu cầu không hợp lệ hoặc trùng lặp, đã bị từ chối kèm lý do.',
  },
};

export const PRIORITY_METADATA: Record<
  TicketPriority,
  {
    label: string;
    color: string;
    responseSla: string;
    resolutionSla: string;
  }
> = {
  P1: {
    label: 'P1 – Critical',
    color: 'red',
    responseSla: '15 phút',
    resolutionSla: '4 giờ',
  },
  P2: {
    label: 'P2 – High',
    color: 'volcano',
    responseSla: '1 giờ',
    resolutionSla: '8 giờ',
  },
  P3: {
    label: 'P3 – Medium',
    color: 'gold',
    responseSla: '4 giờ',
    resolutionSla: '24 giờ',
  },
  P4: {
    label: 'P4 – Low',
    color: 'green',
    responseSla: '8 giờ',
    resolutionSla: '72 giờ',
  },
};

export function computePreviewPriority(
  impact: ImpactLevel,
  urgency: UrgencyLevel,
): TicketPriority {
  const matrix: Record<ImpactLevel, Record<UrgencyLevel, TicketPriority>> = {
    HIGH: { HIGH: 'P1', MEDIUM: 'P2', LOW: 'P3' },
    MEDIUM: { HIGH: 'P2', MEDIUM: 'P3', LOW: 'P4' },
    LOW: { HIGH: 'P3', MEDIUM: 'P4', LOW: 'P4' },
  };
  return matrix[impact][urgency];
}
