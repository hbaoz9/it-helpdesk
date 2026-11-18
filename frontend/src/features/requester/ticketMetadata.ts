import type {
  TicketPriority,
  TicketStatus,
} from '../../shared/api/types';

export const STATUS_METADATA: Record<
  TicketStatus,
  { label: string; color: string; description: string }
> = {
  NEW: {
    label: 'Mới tạo',
    color: 'blue',
    description: 'Yêu cầu đã được gửi và đang chờ bộ phận IT tiếp nhận.',
  },
  TRIAGED: {
    label: 'Đã phân loại',
    color: 'cyan',
    description: 'Đã xác định mức ưu tiên, chờ phân công kỹ thuật viên.',
  },
  ASSIGNED: {
    label: 'Đã phân công',
    color: 'geekblue',
    description: 'Đã giao cho kỹ thuật viên phụ trách.',
  },
  IN_PROGRESS: {
    label: 'Đang xử lý',
    color: 'processing',
    description: 'Kỹ thuật viên đang kiểm tra và khắc phục sự cố.',
  },
  WAITING_REQUESTER: {
    label: 'Chờ phản hồi',
    color: 'warning',
    description: 'Kỹ thuật viên cần bạn cung cấp thêm thông tin để tiếp tục xử lý.',
  },
  RESOLVED: {
    label: 'Đã giải quyết',
    color: 'success',
    description:
      'Kỹ thuật viên đã hoàn tất xử lý yêu cầu.',
  },
  CLOSED: {
    label: 'Đã đóng',
    color: 'default',
    description: 'Yêu cầu đã hoàn tất và kết thúc vòng đời.',
  },
  REJECTED: {
    label: 'Từ chối',
    color: 'error',
    description: 'Yêu cầu đã bị từ chối. Liên hệ bộ phận IT nếu bạn cần làm rõ.',
  },
};
export const PRIORITY_METADATA: Record<
  TicketPriority,
  {
    label: string;
    color: string;
  }
> = {
  P1: {
    label: 'P1 – Critical',
    color: 'red',
  },
  P2: {
    label: 'P2 – High',
    color: 'volcano',
  },
  P3: {
    label: 'P3 – Medium',
    color: 'gold',
  },
  P4: {
    label: 'P4 – Low',
    color: 'green',
  },
};
