import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Drawer,
  Empty,
  Input,
  Row,
  Col,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { ApiError } from "../../api/client";
import { getTickets } from "../../api/tickets";
import type { TicketRecord, TicketStatus } from "../../api/types";
import {
  PRIORITY_METADATA,
  STATUS_METADATA,
} from "./ticketMetadata";

const STATUS_FILTER_OPTIONS: { value: "ALL" | TicketStatus; label: string }[] =
  [
    { value: "ALL", label: "Tất cả trạng thái" },
    { value: "NEW", label: "NEW – Mới tạo" },
    { value: "TRIAGED", label: "TRIAGED – Đã phân loại" },
    { value: "ASSIGNED", label: "ASSIGNED – Đã phân công" },
    { value: "IN_PROGRESS", label: "IN_PROGRESS – Đang xử lý" },
    { value: "WAITING_REQUESTER", label: "WAITING_REQUESTER – Chờ phản hồi" },
    { value: "RESOLVED", label: "RESOLVED – Đã giải quyết" },
    { value: "CLOSED", label: "CLOSED – Đã đóng" },
    { value: "REJECTED", label: "REJECTED – Từ chối" },
  ];

const PRIORITY_FILTER_OPTIONS: {
  value: "ALL" | TicketRecord["priority"];
  label: string;
}[] = [
  { value: "ALL", label: "Tất cả mức ưu tiên" },
  { value: "P1", label: "P1 – Critical" },
  { value: "P2", label: "P2 – High" },
  { value: "P3", label: "P3 – Medium" },
  { value: "P4", label: "P4 – Low" },
];

function MyTicketsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | TicketStatus>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<
    "ALL" | TicketRecord["priority"]
  >("ALL");
  const [tickets, setTickets] = useState<TicketRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selectedCode = searchParams.get("selected");
  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.code === selectedCode) ?? null,
    [tickets, selectedCode],
  );

  useEffect(() => {
    let active = true;
    getTickets({
      search: searchQuery.trim() || undefined,
      status: statusFilter === "ALL" ? undefined : statusFilter,
      priority: priorityFilter === "ALL" ? undefined : priorityFilter,
    })
      .then((result) => {
        if (active) {
          setTickets(result);
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof ApiError
              ? cause.message
              : "Không thể tải Ticket từ Backend.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [searchQuery, statusFilter, priorityFilter]);

  const handleOpenDetail = (ticket: TicketRecord) => {
    setSearchParams({ selected: ticket.code });
  };

  const handleCloseDetail = () => setSearchParams({});

  const columns: ColumnsType<TicketRecord> = [
    {
      title: "Mã yêu cầu",
      dataIndex: "code",
      key: "code",
      width: 150,
      render: (code: string) => (
        <Typography.Text strong style={{ color: "#38bdf8" }}>
          {code}
        </Typography.Text>
      ),
    },
    {
      title: "Tiêu đề sự cố",
      dataIndex: "title",
      key: "title",
      render: (title: string, record) => (
        <div>
          <div style={{ fontWeight: 600, color: "#f8fafc" }}>{title}</div>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {record.category.name}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: "Mức ưu tiên",
      dataIndex: "priority",
      key: "priority",
      width: 145,
      render: (priority: TicketRecord["priority"]) => {
        const meta = PRIORITY_METADATA[priority];
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 230,
      render: (status: TicketStatus) => (
        <Tag color={STATUS_METADATA[status].color}>
          {STATUS_METADATA[status].label}
        </Tag>
      ),
    },
    {
      title: "Người xử lý",
      key: "assignee",
      width: 190,
      responsive: ["lg"],
      render: (_, ticket) =>
        ticket.assignee?.fullName ?? (
          <Typography.Text type="secondary">Chưa phân công</Typography.Text>
        ),
    },
    {
      title: "Thời điểm tạo",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 180,
      responsive: ["md"],
      render: (value: string) => new Date(value).toLocaleString("vi-VN"),
    },
    {
      title: "Chi tiết",
      key: "action",
      width: 120,
      render: (_, record) => (
        <Button
          type="primary"
          ghost
          size="small"
          onClick={() => handleOpenDetail(record)}
        >
          Xem chi tiết
        </Button>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <div className="rp-card rp-dark-form">
        <div className="rp-card-header">
          <div>
            <h2 className="rp-card-title">Danh sách Ticket của tôi</h2>
            <p className="rp-card-subtitle">
              Dữ liệu được lọc theo tài khoản đang đăng nhập.
            </p>
          </div>
          <button
            type="button"
            className="rp-btn-primary"
            onClick={() => navigate("/requester/tickets/new")}
          >
            + Tạo yêu cầu hỗ trợ
          </button>
        </div>

        <Row gutter={[12, 12]} style={{ marginBottom: 18 }}>
          <Col xs={24} md={10}>
            <Input.Search
              allowClear
              placeholder="Tìm theo mã Ticket hoặc tiêu đề..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </Col>
          <Col xs={24} sm={12} md={7}>
            <Select
              style={{ width: "100%" }}
              value={statusFilter}
              options={STATUS_FILTER_OPTIONS}
              onChange={setStatusFilter}
            />
          </Col>
          <Col xs={24} sm={12} md={7}>
            <Select
              style={{ width: "100%" }}
              value={priorityFilter}
              options={PRIORITY_FILTER_OPTIONS}
              onChange={setPriorityFilter}
            />
          </Col>
        </Row>

        {error && (
          <Alert
            type="error"
            showIcon
            message="Không tải được Ticket"
            description={error}
            style={{ marginBottom: 16 }}
          />
        )}
        {loading ? (
          <div style={{ textAlign: "center", padding: 32 }}>
            <Spin />
          </div>
        ) : (
          <Table<TicketRecord>
            rowKey="id"
            columns={columns}
            dataSource={tickets}
            pagination={{ pageSize: 5, showSizeChanger: false }}
            locale={{
              emptyText: (
                <Empty description="Không có Ticket nào khớp với bộ lọc." />
              ),
            }}
          />
        )}
      </div>

      <Drawer
        title={selectedTicket ? `Chi tiết yêu cầu: ${selectedTicket.code}` : "Chi tiết Ticket"}
        width={680}
        open={Boolean(selectedTicket)}
        onClose={handleCloseDetail}
      >
        {selectedTicket && (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Alert
              type="info"
              showIcon
              message={STATUS_METADATA[selectedTicket.status].label}
              description={STATUS_METADATA[selectedTicket.status].description}
            />
            <Typography.Title level={5} style={{ margin: 0 }}>
              {selectedTicket.title}
            </Typography.Title>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="Mã Ticket">
                <strong style={{ color: "#38bdf8" }}>{selectedTicket.code}</strong>
              </Descriptions.Item>
              <Descriptions.Item label="Loại yêu cầu">
                <Tag>{selectedTicket.type}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Danh mục" span={2}>
                {selectedTicket.category.name}
              </Descriptions.Item>
              <Descriptions.Item label="Impact">
                <Tag>{selectedTicket.impact}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Urgency">
                <Tag>{selectedTicket.urgency}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Mức ưu tiên">
                <Tag color={PRIORITY_METADATA[selectedTicket.priority].color}>
                  {PRIORITY_METADATA[selectedTicket.priority].label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Phiên bản dữ liệu">
                <code>v{selectedTicket.version}</code>
              </Descriptions.Item>
              <Descriptions.Item label="Kỹ thuật viên" span={2}>
                {selectedTicket.assignee?.fullName ?? "Chưa phân công"}
              </Descriptions.Item>
              <Descriptions.Item label="Thời điểm tạo" span={2}>
                {new Date(selectedTicket.createdAt).toLocaleString("vi-VN")}
              </Descriptions.Item>
            </Descriptions>
            <Card size="small" title="Mô tả chi tiết">
              <Typography.Paragraph style={{ marginBottom: 0 }}>
                {selectedTicket.description}
              </Typography.Paragraph>
            </Card>
            {selectedTicket.resolutionNote && (
              <Card size="small" title="Nội dung giải pháp">
                <Typography.Paragraph style={{ marginBottom: 0 }}>
                  {selectedTicket.resolutionNote}
                </Typography.Paragraph>
              </Card>
            )}
          </Space>
        )}
      </Drawer>
    </Space>
  );
}

export default MyTicketsPage;
