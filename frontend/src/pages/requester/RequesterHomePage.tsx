import { useNavigate } from "react-router-dom";
import {
  Button,
  Card,
  Col,
  Descriptions,
  Row,
  Space,
  Statistic,
  Steps,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";

import {
  MOCK_REQUESTER_TICKETS,
  PRIORITY_METADATA,
  STATUS_METADATA,
} from "./requesterMockData";
import type { MockTicket } from "./requesterMockData";

function RequesterHomePage() {
  const navigate = useNavigate();

  const totalCount = MOCK_REQUESTER_TICKETS.length;
  const activeCount = MOCK_REQUESTER_TICKETS.filter((ticket) =>
    ["NEW", "TRIAGED", "ASSIGNED", "IN_PROGRESS"].includes(ticket.status)
  ).length;
  const actionRequiredCount = MOCK_REQUESTER_TICKETS.filter((ticket) =>
    ["WAITING_REQUESTER", "RESOLVED"].includes(ticket.status)
  ).length;
  const closedCount = MOCK_REQUESTER_TICKETS.filter(
    (ticket) => ticket.status === "CLOSED"
  ).length;

  const recentColumns: ColumnsType<MockTicket> = [
    {
      title: "Mã Ticket",
      dataIndex: "code",
      key: "code",
      width: 130,
      render: (code: string) => (
        <Typography.Text strong>{code}</Typography.Text>
      ),
    },
    {
      title: "Tiêu đề sự cố",
      dataIndex: "title",
      key: "title",
    },
    {
      title: "Danh mục",
      dataIndex: "categoryName",
      key: "categoryName",
      responsive: ["md"],
    },
    {
      title: "Ưu tiên",
      dataIndex: "priority",
      key: "priority",
      width: 135,
      render: (priority: MockTicket["priority"]) => {
        const meta = PRIORITY_METADATA[priority];
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 220,
      render: (status: MockTicket["status"]) => {
        const meta = STATUS_METADATA[status];
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: "Thao tác",
      key: "action",
      width: 130,
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          onClick={() =>
            navigate(`/requester/tickets?selected=${record.code}`)
          }
        >
          Xem chi tiết
        </Button>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      {/* Khu vực thống kê nhanh (Dữ liệu minh họa) */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card variant="borderless">
            <Statistic
              title="Tổng Ticket của tôi (Minh họa)"
              value={totalCount}
              suffix="yêu cầu"
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card variant="borderless">
            <Statistic
              title="Đang chờ / Đang xử lý"
              value={activeCount}
              valueStyle={{ color: "#0284c7" }}
              suffix="Ticket"
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card variant="borderless">
            <Statistic
              title="Cần phản hồi / Xác nhận"
              value={actionRequiredCount}
              valueStyle={{ color: "#d97706" }}
              suffix="Ticket"
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card variant="borderless">
            <Statistic
              title="Đã hoàn tất (CLOSED)"
              value={closedCount}
              valueStyle={{ color: "#16a34a" }}
              suffix="Ticket"
            />
          </Card>
        </Col>
      </Row>

      {/* Vòng đời xử lý sự cố theo SRS 6.1 */}
      <Card
        title="Quy trình xử lý sự cố tiêu chuẩn (Incident Workflow V1)"
        extra={
          <Tag color="blue">Chuẩn hóa theo SRS &amp; API Contract</Tag>
        }
      >
        <Steps
          size="small"
          current={3}
          items={[
            {
              title: "NEW",
              description: "Requester gửi yêu cầu",
            },
            {
              title: "TRIAGED",
              description: "Phân loại & tính Priority",
            },
            {
              title: "ASSIGNED",
              description: "Giao kỹ thuật viên",
            },
            {
              title: "IN_PROGRESS",
              description: "Kỹ thuật viên xử lý",
            },
            {
              title: "RESOLVED",
              description: "Chờ Requester xác nhận",
            },
            {
              title: "CLOSED",
              description: "Đóng yêu cầu",
            },
          ]}
        />
      </Card>

      {/* Danh sách Ticket gần đây */}
      <Card
        title="Yêu cầu hỗ trợ gần đây của tôi (Dữ liệu minh họa – chưa kết nối Backend)"
        extra={
          <Space>
            <Button onClick={() => navigate("/requester/tickets")}>
              Xem tất cả Ticket
            </Button>
            <Button
              type="primary"
              onClick={() => navigate("/requester/tickets/new")}
            >
              + Tạo yêu cầu mới
            </Button>
          </Space>
        }
      >
        <Table<MockTicket>
          rowKey="id"
          columns={recentColumns}
          dataSource={MOCK_REQUESTER_TICKETS.slice(0, 4)}
          pagination={false}
          size="middle"
        />
      </Card>

      {/* Thông tin hướng dẫn SLA & Quyền của Requester */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="Chính sách cam kết thời gian SLA 24/7 (Tham chiếu V1)">
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="P1 – Critical">
                Phản hồi đầu tiên: <strong>15 phút</strong> · Giải quyết:{" "}
                <strong>4 giờ</strong>
              </Descriptions.Item>
              <Descriptions.Item label="P2 – High">
                Phản hồi đầu tiên: <strong>1 giờ</strong> · Giải quyết:{" "}
                <strong>8 giờ</strong>
              </Descriptions.Item>
              <Descriptions.Item label="P3 – Medium">
                Phản hồi đầu tiên: <strong>4 giờ</strong> · Giải quyết:{" "}
                <strong>24 giờ</strong>
              </Descriptions.Item>
              <Descriptions.Item label="P4 – Low">
                Phản hồi đầu tiên: <strong>8 giờ</strong> · Giải quyết:{" "}
                <strong>72 giờ</strong>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Lưu ý dành cho người gửi yêu cầu (Requester)">
            <Space direction="vertical" size={8}>
              <Typography.Text>
                • <strong>Phạm vi truy cập:</strong> Bạn chỉ xem và thao tác
                trên các Ticket do chính mình gửi; ghi chú nội bộ (Internal
                Notes) của bộ phận IT được bảo mật.
              </Typography.Text>
              <Typography.Text>
                • <strong>Bổ sung thông tin (WAITING_REQUESTER):</strong> Khi
                kỹ thuật viên cần thêm thông tin, gửi bình luận phản hồi sẽ
                chuyển Ticket trở lại trạng thái đang xử lý.
              </Typography.Text>
              <Typography.Text>
                • <strong>Xác nhận hoặc Mở lại (RESOLVED):</strong> Bạn có thể
                xác nhận đóng Ticket hoặc yêu cầu mở lại (Reopen) kèm lý do
                trong vòng <strong>72 giờ</strong>. Quá 72 giờ không phản hồi,
                hệ thống tự động chuyển sang <strong>CLOSED</strong>.
              </Typography.Text>
            </Space>
          </Card>
        </Col>
      </Row>
    </Space>
  );
}

export default RequesterHomePage;
