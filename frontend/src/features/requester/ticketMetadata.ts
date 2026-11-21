import type {
  ImpactLevel,
  TicketPriority,
  TicketStatus,
  UrgencyLevel,
} from '../../shared/api/types';

export const STATUS_METADATA: Record<
  TicketStatus,
  { label: string; color: string; description: string; stepIndex: number }
> = {
  NEW: {
    label: 'Mới tạo',
    color: 'blue',
    description: 'Yêu cầu đã được gửi và đang chờ bộ phận IT tiếp nhận.',
    stepIndex: 0,
  },
  TRIAGED: {
    label: 'Đã phân loại',
    color: 'cyan',
    description: 'Đã xác định mức ưu tiên, chờ phân công kỹ thuật viên.',
    stepIndex: 1,
  },
  ASSIGNED: {
    label: 'Đã phân công',
    color: 'geekblue',
    description: 'Đã giao cho kỹ thuật viên phụ trách.',
    stepIndex: 2,
  },
  IN_PROGRESS: {
    label: 'Đang xử lý',
    color: 'processing',
    description: 'Kỹ thuật viên đang kiểm tra và khắc phục sự cố.',
    stepIndex: 3,
  },
  WAITING_REQUESTER: {
    label: 'Chờ phản hồi',
    color: 'warning',
    description:
      'Kỹ thuật viên cần bạn cung cấp thêm thông tin để tiếp tục xử lý.',
    stepIndex: 3,
  },
  RESOLVED: {
    label: 'Đã giải quyết',
    color: 'success',
    description:
      'Kỹ thuật viên đã hoàn tất xử lý yêu cầu. Vui lòng xác nhận đóng hoặc mở lại trong vòng 72 giờ.',
    stepIndex: 4,
  },
  CLOSED: {
    label: 'Đã đóng',
    color: 'default',
    description: 'Yêu cầu đã hoàn tất và kết thúc vòng đời.',
    stepIndex: 5,
  },
  REJECTED: {
    label: 'Từ chối',
    color: 'error',
    description:
      'Yêu cầu đã bị từ chối. Liên hệ bộ phận IT nếu bạn cần làm rõ.',
    stepIndex: 1,
  },
};

export const PRIORITY_METADATA: Record<
  TicketPriority,
  {
    label: string;
    shortLabel: string;
    color: string;
    responseSla: string;
    resolutionSla: string;
  }
> = {
  P1: {
    label: 'P1 – Khẩn cấp (Critical)',
    shortLabel: 'P1 – Critical',
    color: 'red',
    responseSla: '15 phút',
    resolutionSla: '4 giờ',
  },
  P2: {
    label: 'P2 – Cao (High)',
    shortLabel: 'P2 – High',
    color: 'volcano',
    responseSla: '1 giờ',
    resolutionSla: '8 giờ',
  },
  P3: {
    label: 'P3 – Trung bình (Medium)',
    shortLabel: 'P3 – Medium',
    color: 'gold',
    responseSla: '4 giờ',
    resolutionSla: '24 giờ',
  },
  P4: {
    label: 'P4 – Thấp (Low)',
    shortLabel: 'P4 – Low',
    color: 'green',
    responseSla: '8 giờ',
    resolutionSla: '72 giờ',
  },
};

export const IMPACT_METADATA: Record<
  ImpactLevel,
  { label: string; description: string; color: string }
> = {
  LOW: {
    label: 'Cá nhân (Thấp)',
    description: 'Một người bị ảnh hưởng',
    color: 'default',
  },
  MEDIUM: {
    label: 'Nhóm / Phòng ban (Trung bình)',
    description: 'Một nhóm hoặc phòng ban bị ảnh hưởng',
    color: 'blue',
  },
  HIGH: {
    label: 'Nhiều phòng ban / Toàn công ty (Cao)',
    description: 'Ảnh hưởng diện rộng tới hoạt động chung',
    color: 'volcano',
  },
};

export const URGENCY_METADATA: Record<
  UrgencyLevel,
  { label: string; description: string; color: string }
> = {
  LOW: {
    label: 'Có thể chờ (Thấp)',
    description: 'Chưa làm gián đoạn công việc chính',
    color: 'default',
  },
  MEDIUM: {
    label: 'Cần hỗ trợ sớm (Trung bình)',
    description: 'Ảnh hưởng đến tiến độ công việc trong ngày',
    color: 'gold',
  },
  HIGH: {
    label: 'Cần hỗ trợ ngay (Khẩn cấp)',
    description: 'Công việc bị ngưng trệ hoàn toàn',
    color: 'red',
  },
};

export function computePreviewPriority(
  impact?: ImpactLevel,
  urgency?: UrgencyLevel,
): TicketPriority | null {
  if (!impact || !urgency) return null;
  const matrix: Record<ImpactLevel, Record<UrgencyLevel, TicketPriority>> = {
    LOW: { LOW: 'P4', MEDIUM: 'P4', HIGH: 'P3' },
    MEDIUM: { LOW: 'P4', MEDIUM: 'P3', HIGH: 'P2' },
    HIGH: { LOW: 'P3', MEDIUM: 'P2', HIGH: 'P1' },
  };
  return matrix[impact][urgency];
}
