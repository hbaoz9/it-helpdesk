import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Button,
  Col,
  Descriptions,
  Row,
  Space,
  Statistic,
  Steps,
  Table,
  Tag,
  Typography,
  Spin,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { getTickets } from "../../api/tickets";
import type { TicketRecord } from "../../api/types";

import {
  PRIORITY_METADATA,
  STATUS_METADATA,
} from "./ticketMetadata";

function RequesterHomePage() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<TicketRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getTickets()
      .then((result) => {
        if (active) setTickets(result);
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Không tải được Ticket");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const totalCount = tickets.length;
  const activeCount = tickets.filter((ticket) =>
    ["NEW", "TRIAGED", "ASSIGNED", "IN_PROGRESS"].includes(ticket.status)
  ).length;
  const actionRequiredCount = tickets.filter((ticket) =>
    ["WAITING_REQUESTER", "RESOLVED"].includes(ticket.status)
  ).length;
  const closedCount = tickets.filter(
    (ticket) => ticket.status === "CLOSED"
  ).length;

  const recentColumns: ColumnsType<TicketRecord> = [
    {
      title: "Mã Ticket",
      dataIndex: "code",
      key: "code",
      width: 130,
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
      render: (title: string) => (
        <span style={{ color: "#f8fafc", fontWeight: 500 }}>{title}</span>
      ),
    },
    {
      title: "Danh mục",
      key: "category",
      responsive: ["md"],
      render: (_, ticket) => ticket.category.name,
    },
    {
      title: "Ưu tiên",
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
      width: 225,
      render: (status: TicketRecord["status"]) => {
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
      {/* Quick statistics calculated from the current user's tickets. */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <div className="rp-card" style={{ padding: 20 }}>
            <Statistic
              title="Tổng Ticket của tôi"
              value={totalCount}
              valueStyle={{ color: "#f8fafc", fontWeight: 800 }}
              suffix="yêu cầu"
            />
          </div>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <div className="rp-card" style={{ padding: 20 }}>
            <Statistic
              title="Đang chờ / Đang xử lý"
              value={activeCount}
              valueStyle={{ color: "#38bdf8", fontWeight: 800 }}
              suffix="Ticket"
            />
          </div>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <div className="rp-card" style={{ padding: 20 }}>
            <Statistic
              title="Cần phản hồi / Xác nhận"
              value={actionRequiredCount}
              valueStyle={{ color: "#fbbf24", fontWeight: 800 }}
              suffix="Ticket"
            />
          </div>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <div className="rp-card" style={{ padding: 20 }}>
            <Statistic
              title="Đã hoàn tất (CLOSED)"
              value={closedCount}
              valueStyle={{ color: "#4ade80", fontWeight: 800 }}
              suffix="Ticket"
            />
          </div>
        </Col>
      </Row>

      {/* Vòng đời xử lý sự cố theo SRS 6.1 */}
      <div className="rp-card">
        <div className="rp-card-header">
          <div>
            <h2 className="rp-card-title">
              Quy trình xử lý sự cố tiêu chuẩn{" "}
              <span>(Incident Workflow V1)</span>
            </h2>
            <p className="rp-card-subtitle">
              Vòng đời trạng thái chuẩn hóa theo tài liệu SRS &amp; API Contract
            </p>
          </div>
          <span className="rp-matrix-badge">SRS Baseline</span>
        </div>

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
      </div>

      {/* Danh sách Ticket gần đây */}
      <div className="rp-card">
        <div className="rp-card-header">
          <div>
            <h2 className="rp-card-title">
              Yêu cầu hỗ trợ gần đây của tôi
            </h2>
            <p className="rp-card-subtitle">
              Nhấp Xem chi tiết để kiểm tra ngăn thông tin SLA, trao đổi công
              khai và thao tác xác nhận/mở lại
            </p>
          </div>

          <Space wrap>
            <button
              type="button"
              className="rp-btn-secondary"
              onClick={() => navigate("/requester/tickets")}
            >
              Xem tất cả Ticket
            </button>
            <button
              type="button"
              className="rp-btn-primary"
              onClick={() => navigate("/requester/tickets/new")}
            >
              + Tạo yêu cầu mới
            </button>
          </Space>
        </div>

        {error && (
          <Alert type="error" showIcon message="Không tải được Ticket" description={error} />
        )}
        {loading ? (
          <Spin />
        ) : (
          <Table<TicketRecord>
            rowKey="id"
            columns={recentColumns}
            dataSource={tickets.slice(0, 4)}
            pagination={false}
            size="middle"
          />
        )}
      </div>

      {/* Thông tin hướng dẫn SLA & Quyền của Requester */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <div className="rp-card" style={{ height: "100%" }}>
            <div className="rp-side-header">
              <h3 className="rp-side-title">
                <span className="rp-cyan-dot" />
                <span>Chính sách cam kết thời gian SLA 24/7 (V1)</span>
              </h3>
            </div>

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
          </div>
        </Col>

        <Col xs={24} lg={12}>
          <div className="rp-card" style={{ height: "100%" }}>
            <div className="rp-side-header">
              <h3 className="rp-side-title">
                <span className="rp-green-dot" />
                <span>Lưu ý dành cho người gửi yêu cầu (Requester)</span>
              </h3>
            </div>

            <ul className="rp-rule-list" style={{ marginBottom: 0 }}>
              <li>
                <strong>Phạm vi truy cập:</strong> Bạn chỉ xem và thao tác trên
                các Ticket do chính mình gửi; ghi chú nội bộ (
                <code>INTERNAL</code>) của bộ phận IT được bảo mật.
              </li>
              <li>
                <strong>Bổ sung thông tin (WAITING_REQUESTER):</strong> Khi kỹ
                thuật viên cần thêm thông tin, gửi bình luận phản hồi sẽ chuyển
                Ticket trở lại trạng thái <code>IN_PROGRESS</code>.
              </li>
              <li>
                <strong>Xác nhận hoặc Mở lại (RESOLVED):</strong> Bạn có thể xác
                nhận đóng Ticket hoặc yêu cầu mở lại (Reopen) kèm lý do trong
                vòng <strong>72 giờ</strong>.
              </li>
            </ul>
          </div>
        </Col>
      </Row>
    </Space>
  );
}

export default RequesterHomePage;
