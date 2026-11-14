import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Drawer,
  Empty,
  Input,
  List,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";

import {
  MOCK_REQUESTER_TICKETS,
  PRIORITY_METADATA,
  STATUS_METADATA,
} from "./requesterMockData";
import type {
  MockTicket,
  PriorityLevel,
  TicketStatus,
} from "./requesterMockData";

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
  value: "ALL" | PriorityLevel;
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
  const [priorityFilter, setPriorityFilter] = useState<"ALL" | PriorityLevel>(
    "ALL"
  );
  const [replyDraft, setReplyDraft] = useState("");
  const [messageApi, contextHolder] = message.useMessage();

  const selectedCode = searchParams.get("selected");

  const selectedTicket = useMemo(
    () =>
      MOCK_REQUESTER_TICKETS.find((item) => item.code === selectedCode) ?? null,
    [selectedCode]
  );

  const filteredTickets = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return MOCK_REQUESTER_TICKETS.filter((ticket) => {
      const matchesStatus =
        statusFilter === "ALL" || ticket.status === statusFilter;
      const matchesPriority =
        priorityFilter === "ALL" || ticket.priority === priorityFilter;
      const matchesQuery =
        !normalizedQuery ||
        ticket.code.toLowerCase().includes(normalizedQuery) ||
        ticket.title.toLowerCase().includes(normalizedQuery) ||
        ticket.categoryName.toLowerCase().includes(normalizedQuery);
      return matchesStatus && matchesPriority && matchesQuery;
    });
  }, [searchQuery, statusFilter, priorityFilter]);

  const handleOpenDetail = (ticket: MockTicket) => {
    setSearchParams({ selected: ticket.code });
  };

  const handleCloseDetail = () => {
    setSearchParams({});
    setReplyDraft("");
  };

  const handlePreviewWorkflowAction = (
    actionLabel: string,
    endpoint: string
  ) => {
    messageApi.info(
      `Thao tác "${actionLabel}" (expectedVersion: ${
        selectedTicket?.version ?? 1
      }) đang ở mức giao diện minh họa Tuần 3. Sẽ kết nối API ${endpoint} ở Sprint tiếp theo.`
    );
  };

  const columns: ColumnsType<MockTicket> = [
    {
      title: "Mã yêu cầu",
      dataIndex: "code",
      key: "code",
      width: 125,
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
            {record.categoryName}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: "Mức ưu tiên",
      dataIndex: "priority",
      key: "priority",
      width: 145,
      render: (priority: PriorityLevel) => {
        const meta = PRIORITY_METADATA[priority];
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: "Trạng thái (Contract)",
      dataIndex: "status",
      key: "status",
      width: 230,
      render: (status: TicketStatus) => {
        const meta = STATUS_METADATA[status];
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: "Người xử lý",
      dataIndex: "assigneeName",
      key: "assigneeName",
      width: 190,
      responsive: ["lg"],
      render: (assigneeName: string | null) =>
        assigneeName ? (
          <span style={{ color: "#cbd5e1" }}>{assigneeName}</span>
        ) : (
          <Typography.Text type="secondary">Chưa phân công</Typography.Text>
        ),
    },
    {
      title: "Thời điểm tạo",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 165,
      responsive: ["md"],
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
      {contextHolder}

      <div className="rp-card rp-dark-form">
        <div className="rp-card-header">
          <div>
            <h2 className="rp-card-title">
              Danh sách Ticket của tôi{" "}
              <span>(Dữ liệu minh họa – chưa kết nối Backend)</span>
            </h2>
            <p className="rp-card-subtitle">
              Lọc theo trạng thái chuẩn trong API Contract hoặc tra cứu nhanh
              theo mã Ticket
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
              placeholder="Tìm theo mã Ticket (VD: INC-000014) hoặc tiêu đề..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </Col>

          <Col xs={24} sm={12} md={7}>
            <Select
              style={{ width: "100%" }}
              value={statusFilter}
              options={STATUS_FILTER_OPTIONS}
              onChange={(val) => setStatusFilter(val)}
            />
          </Col>

          <Col xs={24} sm={12} md={7}>
            <Select
              style={{ width: "100%" }}
              value={priorityFilter}
              options={PRIORITY_FILTER_OPTIONS}
              onChange={(val) => setPriorityFilter(val)}
            />
          </Col>
        </Row>

        <Table<MockTicket>
          rowKey="id"
          columns={columns}
          dataSource={filteredTickets}
          pagination={{ pageSize: 5, showSizeChanger: false }}
          locale={{
            emptyText: (
              <Empty description="Không có Ticket minh họa nào khớp với bộ lọc hiện tại." />
            ),
          }}
        />
      </div>

      {/* Drawer xem chi tiết Ticket ở mức giao diện nền tảng */}
      <Drawer
        title={
          selectedTicket
            ? `Chi tiết yêu cầu: ${selectedTicket.code} (Dữ liệu minh họa)`
            : "Chi tiết Ticket"
        }
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
                <strong style={{ color: "#38bdf8" }}>
                  {selectedTicket.code}
                </strong>
              </Descriptions.Item>
              <Descriptions.Item label="Loại yêu cầu">
                <Tag>{selectedTicket.type}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Danh mục" span={2}>
                {selectedTicket.categoryName}
              </Descriptions.Item>
              <Descriptions.Item label="Impact (Ảnh hưởng)">
                <Tag>{selectedTicket.impact}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Urgency (Khẩn cấp)">
                <Tag>{selectedTicket.urgency}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Mức ưu tiên (Priority)">
                <Tag color={PRIORITY_METADATA[selectedTicket.priority].color}>
                  {PRIORITY_METADATA[selectedTicket.priority].label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Phiên bản dữ liệu (version)">
                <code>v{selectedTicket.version}</code>
              </Descriptions.Item>
              <Descriptions.Item label="Kỹ thuật viên xử lý" span={2}>
                {selectedTicket.assigneeName ?? "Chưa phân công"}
              </Descriptions.Item>
              <Descriptions.Item label="Hạn phản hồi (SLA)">
                {selectedTicket.responseDueAt}
              </Descriptions.Item>
              <Descriptions.Item label="Hạn giải quyết (SLA)">
                {selectedTicket.resolutionDueAt}
              </Descriptions.Item>
            </Descriptions>

            <Card size="small" title="Mô tả chi tiết từ Requester">
              <Typography.Paragraph style={{ marginBottom: 0 }}>
                {selectedTicket.description}
              </Typography.Paragraph>
            </Card>

            {selectedTicket.resolutionNote && (
              <Card
                size="small"
                title="Nội dung giải pháp từ Kỹ thuật viên (Resolution Note)"
              >
                <Typography.Paragraph style={{ marginBottom: 0 }}>
                  {selectedTicket.resolutionNote}
                </Typography.Paragraph>
              </Card>
            )}

            {/* Khu vực thao tác nghiệp vụ minh họa cho Requester khi Ticket ở trạng thái RESOLVED */}
            {selectedTicket.status === "RESOLVED" && (
              <Card
                size="small"
                title="Xác nhận kết quả xử lý (Minh họa UI – Tuần 3)"
              >
                <Typography.Paragraph
                  type="secondary"
                  style={{ fontSize: 13 }}
                >
                  Theo quy tắc BR-05, khi Ticket ở trạng thái{" "}
                  <strong>RESOLVED</strong>, Requester có thể xác nhận đóng hoặc
                  yêu cầu mở lại (Reopen) kèm lý do trong vòng 72 giờ.
                </Typography.Paragraph>
                <Space wrap>
                  <Button
                    type="primary"
                    onClick={() =>
                      handlePreviewWorkflowAction(
                        "Xác nhận hoàn tất (RESOLVED → CLOSED)",
                        `POST /api/v1/tickets/${selectedTicket.id}/confirm`
                      )
                    }
                  >
                    Xác nhận đã giải quyết (Confirm)
                  </Button>
                  <Button
                    danger
                    onClick={() =>
                      handlePreviewWorkflowAction(
                        "Yêu cầu mở lại trong 72h (RESOLVED → IN_PROGRESS)",
                        `POST /api/v1/tickets/${selectedTicket.id}/reopen`
                      )
                    }
                  >
                    Mở lại yêu cầu (Reopen)
                  </Button>
                </Space>
              </Card>
            )}

            <Divider style={{ margin: "4px 0" }} />

            <Card
              size="small"
              title="Trao đổi công khai (PUBLIC Comments – Không hiển thị Internal Notes)"
            >
              <List
                locale={{
                  emptyText: "Chưa có bình luận công khai nào trên Ticket này.",
                }}
                dataSource={selectedTicket.publicComments}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta
                      title={
                        <Space>
                          <strong>{item.authorName}</strong>
                          <Tag color="blue">{item.authorRole}</Tag>
                          <Typography.Text
                            type="secondary"
                            style={{ fontSize: 12 }}
                          >
                            {item.createdAt}
                          </Typography.Text>
                        </Space>
                      }
                      description={item.message}
                    />
                  </List.Item>
                )}
              />

              {selectedTicket.status !== "CLOSED" &&
                selectedTicket.status !== "REJECTED" && (
                  <div style={{ marginTop: 12 }}>
                    <Input.TextArea
                      rows={3}
                      value={replyDraft}
                      onChange={(e) => setReplyDraft(e.target.value)}
                      placeholder="Nhập phản hồi công khai hoặc thông tin bổ sung cho kỹ thuật viên..."
                    />
                    <div
                      style={{
                        marginTop: 8,
                        display: "flex",
                        justifyContent: "flex-end",
                      }}
                    >
                      <Button
                        type="primary"
                        onClick={() => {
                          if (!replyDraft.trim()) {
                            messageApi.warning(
                              "Vui lòng nhập nội dung phản hồi trước khi gửi!"
                            );
                            return;
                          }
                          handlePreviewWorkflowAction(
                            "Gửi bình luận PUBLIC",
                            `POST /api/v1/tickets/${selectedTicket.id}/comments`
                          );
                        }}
                      >
                        Gửi phản hồi (Minh họa)
                      </Button>
                    </div>
                  </div>
                )}
            </Card>
          </Space>
        )}
      </Drawer>
    </Space>
  );
}

export default MyTicketsPage;
