export type TicketStatus =
  | "NEW"
  | "TRIAGED"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "WAITING_REQUESTER"
  | "RESOLVED"
  | "CLOSED"
  | "REJECTED";

export type ImpactLevel = "LOW" | "MEDIUM" | "HIGH";
export type UrgencyLevel = "LOW" | "MEDIUM" | "HIGH";
export type PriorityLevel = "P1" | "P2" | "P3" | "P4";

export interface MockComment {
  id: string;
  authorName: string;
  authorRole: "Requester" | "Technician" | "Supervisor";
  message: string;
  createdAt: string;
}

export interface MockTicket {
  id: string;
  code: string;
  type: "INCIDENT";
  title: string;
  description: string;
  categoryId: string;
  categoryName: string;
  impact: ImpactLevel;
  urgency: UrgencyLevel;
  priority: PriorityLevel;
  status: TicketStatus;
  assigneeName: string | null;
  createdAt: string;
  updatedAt: string;
  responseDueAt: string;
  resolutionDueAt: string;
  resolutionNote?: string;
  version: number;
  publicComments: MockComment[];
}

export interface CategoryOption {
  id: string;
  name: string;
  description: string;
}

export const STATUS_METADATA: Record<
  TicketStatus,
  { label: string; color: string; description: string }
> = {
  NEW: {
    label: "NEW · Mới tạo",
    color: "blue",
    description: "Ticket vừa được gửi, đang chờ Supervisor phân loại (Triage).",
  },
  TRIAGED: {
    label: "TRIAGED · Đã phân loại",
    color: "cyan",
    description: "Đã xác định mức ưu tiên, chờ phân công kỹ thuật viên.",
  },
  ASSIGNED: {
    label: "ASSIGNED · Đã phân công",
    color: "geekblue",
    description: "Đã giao cho kỹ thuật viên phụ trách.",
  },
  IN_PROGRESS: {
    label: "IN_PROGRESS · Đang xử lý",
    color: "processing",
    description: "Kỹ thuật viên đang kiểm tra và khắc phục sự cố.",
  },
  WAITING_REQUESTER: {
    label: "WAITING_REQUESTER · Chờ phản hồi",
    color: "warning",
    description: "Kỹ thuật viên cần bạn cung cấp thêm thông tin để tiếp tục xử lý.",
  },
  RESOLVED: {
    label: "RESOLVED · Đã giải quyết",
    color: "success",
    description:
      "Kỹ thuật viên đã hoàn tất xử lý. Vui lòng xác nhận đóng hoặc mở lại trong 72 giờ.",
  },
  CLOSED: {
    label: "CLOSED · Đã đóng",
    color: "default",
    description: "Yêu cầu đã hoàn tất và kết thúc vòng đời.",
  },
  REJECTED: {
    label: "REJECTED · Từ chối",
    color: "error",
    description: "Yêu cầu không hợp lệ hoặc trùng lặp, đã bị từ chối kèm lý do.",
  },
};

export const PRIORITY_METADATA: Record<
  PriorityLevel,
  {
    label: string;
    color: string;
    responseSla: string;
    resolutionSla: string;
  }
> = {
  P1: {
    label: "P1 – Critical",
    color: "red",
    responseSla: "15 phút",
    resolutionSla: "4 giờ",
  },
  P2: {
    label: "P2 – High",
    color: "volcano",
    responseSla: "1 giờ",
    resolutionSla: "8 giờ",
  },
  P3: {
    label: "P3 – Medium",
    color: "gold",
    responseSla: "4 giờ",
    resolutionSla: "24 giờ",
  },
  P4: {
    label: "P4 – Low",
    color: "green",
    responseSla: "8 giờ",
    resolutionSla: "72 giờ",
  },
};

export const MOCK_CATEGORIES: CategoryOption[] = [
  {
    id: "cat-network",
    name: "Mạng & Kết nối (Network / Wi-Fi / VPN)",
    description: "Mất kết nối mạng LAN, Wi-Fi nội bộ, VPN hoặc đường truyền.",
  },
  {
    id: "cat-hardware",
    name: "Thiết bị phần cứng (PC / Laptop / Máy in)",
    description: "Sự cố máy tính, màn hình, máy in phòng ban, thiết bị ngoại vi.",
  },
  {
    id: "cat-software",
    name: "Phần mềm & Ứng dụng nghiệp vụ",
    description: "Lỗi cài đặt hoặc vận hành phần mềm văn phòng, ERP, trình duyệt.",
  },
  {
    id: "cat-account",
    name: "Tài khoản & Quyền truy cập (Email / Portal)",
    description: "Không đăng nhập được hệ thống nội bộ, khóa tài khoản, lỗi xác thực.",
  },
];

/**
 * Ma trận tính Priority dự kiến từ Impact × Urgency (3×3) theo SRS FR-04
 */
export function computePreviewPriority(
  impact: ImpactLevel,
  urgency: UrgencyLevel
): PriorityLevel {
  const matrix: Record<ImpactLevel, Record<UrgencyLevel, PriorityLevel>> = {
    HIGH: {
      HIGH: "P1",
      MEDIUM: "P2",
      LOW: "P3",
    },
    MEDIUM: {
      HIGH: "P2",
      MEDIUM: "P3",
      LOW: "P4",
    },
    LOW: {
      HIGH: "P3",
      MEDIUM: "P4",
      LOW: "P4",
    },
  };
  return matrix[impact][urgency];
}

export const MOCK_REQUESTER_TICKETS: MockTicket[] = [
  {
    id: "a1b2c3d4-0001-4000-8000-000000000001",
    code: "INC-000014",
    type: "INCIDENT",
    title: "Máy in mạng phòng Kế toán báo lỗi Offline không in được",
    description:
      "Từ 08:15 sáng nay, máy in HP LaserJet tại phòng Kế toán (Tầng 3) báo trạng thái Offline trên tất cả máy tính trong phòng dù cáp mạng vẫn sáng đèn.",
    categoryId: "cat-hardware",
    categoryName: "Thiết bị phần cứng (PC / Laptop / Máy in)",
    impact: "MEDIUM",
    urgency: "HIGH",
    priority: "P2",
    status: "IN_PROGRESS",
    assigneeName: "Trần Đức Hiếu (Technician)",
    createdAt: "2026-11-11 08:20 (UTC+7)",
    updatedAt: "2026-11-11 08:45 (UTC+7)",
    responseDueAt: "2026-11-11 09:20 (UTC+7)",
    resolutionDueAt: "2026-11-11 16:20 (UTC+7)",
    version: 3,
    publicComments: [
      {
        id: "cmt-1",
        authorName: "Trần Đức Hiếu",
        authorRole: "Technician",
        message:
          "Kỹ thuật đã tiếp nhận Ticket và đang kiểm tra địa chỉ IP tĩnh của Print Server tại tầng 3.",
        createdAt: "2026-11-11 08:45 (UTC+7)",
      },
    ],
  },
  {
    id: "a1b2c3d4-0002-4000-8000-000000000002",
    code: "INC-000012",
    type: "INCIDENT",
    title: "Không kết nối được VPN nội bộ khi làm việc từ xa",
    description:
      "Ứng dụng FortiClient VPN dừng ở bước 40% và báo lỗi Credential or SSLVPN configuration is wrong.",
    categoryId: "cat-network",
    categoryName: "Mạng & Kết nối (Network / Wi-Fi / VPN)",
    impact: "LOW",
    urgency: "MEDIUM",
    priority: "P4",
    status: "WAITING_REQUESTER",
    assigneeName: "Trần Đức Hiếu (Technician)",
    createdAt: "2026-11-10 14:10 (UTC+7)",
    updatedAt: "2026-11-10 15:05 (UTC+7)",
    responseDueAt: "2026-11-10 22:10 (UTC+7)",
    resolutionDueAt: "2026-11-13 14:10 (UTC+7)",
    version: 4,
    publicComments: [
      {
        id: "cmt-2",
        authorName: "Trần Đức Hiếu",
        authorRole: "Technician",
        message:
          "Chào bạn, vui lòng cho biết phiên bản FortiClient bạn đang sử dụng và mạng Internet hiện tại để kỹ thuật đối chiếu log cổng VPN.",
        createdAt: "2026-11-10 15:05 (UTC+7)",
      },
    ],
  },
  {
    id: "a1b2c3d4-0003-4000-8000-000000000003",
    code: "INC-000009",
    type: "INCIDENT",
    title: "Phần mềm kế toán nội bộ bị treo khi xuất báo cáo tháng",
    description:
      "Khi chọn kết xuất file tổng hợp tháng 10, ứng dụng đứng hình khoảng 2 phút rồi tự đóng.",
    categoryId: "cat-software",
    categoryName: "Phần mềm & Ứng dụng nghiệp vụ",
    impact: "MEDIUM",
    urgency: "MEDIUM",
    priority: "P3",
    status: "RESOLVED",
    assigneeName: "Trần Đức Hiếu (Technician)",
    createdAt: "2026-11-09 09:30 (UTC+7)",
    updatedAt: "2026-11-10 11:00 (UTC+7)",
    responseDueAt: "2026-11-09 13:30 (UTC+7)",
    resolutionDueAt: "2026-11-10 09:30 (UTC+7)",
    resolutionNote:
      "Đã cập nhật bản vá thư viện xuất báo cáo v2.4.2 và dọn bộ nhớ đệm temp trên máy trạm. Vui lòng kiểm tra và xác nhận kết quả.",
    version: 5,
    publicComments: [
      {
        id: "cmt-3",
        authorName: "Trần Đức Hiếu",
        authorRole: "Technician",
        message:
          "Đã cài bản vá v2.4.2 và thử kết xuất thành công báo cáo mẫu. Nhờ bạn kiểm tra lại và bấm Xác nhận đóng Ticket.",
        createdAt: "2026-11-10 11:00 (UTC+7)",
      },
    ],
  },
  {
    id: "a1b2c3d4-0004-4000-8000-000000000004",
    code: "INC-000015",
    type: "INCIDENT",
    title: "Mất tín hiệu mạng LAN tại dãy bàn B2 phòng Hành chính",
    description:
      "4 máy tính tại cụm bàn B2 hiển thị biểu tượng mất mạng Ethernet, Wi-Fi phụ sóng yếu.",
    categoryId: "cat-network",
    categoryName: "Mạng & Kết nối (Network / Wi-Fi / VPN)",
    impact: "HIGH",
    urgency: "HIGH",
    priority: "P1",
    status: "NEW",
    assigneeName: null,
    createdAt: "2026-11-11 08:55 (UTC+7)",
    updatedAt: "2026-11-11 08:55 (UTC+7)",
    responseDueAt: "2026-11-11 09:10 (UTC+7)",
    resolutionDueAt: "2026-11-11 12:55 (UTC+7)",
    version: 1,
    publicComments: [],
  },
  {
    id: "a1b2c3d4-0005-4000-8000-000000000005",
    code: "INC-000003",
    type: "INCIDENT",
    title: "Cấp lại quyền truy cập thư mục dữ liệu chung phòng Nhân sự",
    description:
      "Sau khi đổi máy tính trạm mới, tài khoản miền chưa truy cập được ổ đĩa mạng Z:\\HR-Shared.",
    categoryId: "cat-account",
    categoryName: "Tài khoản & Quyền truy cập (Email / Portal)",
    impact: "LOW",
    urgency: "LOW",
    priority: "P4",
    status: "CLOSED",
    assigneeName: "Trần Đức Hiếu (Technician)",
    createdAt: "2026-11-05 10:00 (UTC+7)",
    updatedAt: "2026-11-06 16:20 (UTC+7)",
    responseDueAt: "2026-11-05 18:00 (UTC+7)",
    resolutionDueAt: "2026-11-08 10:00 (UTC+7)",
    resolutionNote:
      "Đã đồng bộ lại Security Group cho máy trạm mới và người gửi đã xác nhận truy cập bình thường.",
    version: 6,
    publicComments: [],
  },
];
