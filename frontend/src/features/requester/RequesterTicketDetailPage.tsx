import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Result,
  Row,
  Space,
  Spin,
  Steps,
  Tag,
  Typography,
} from 'antd';
import { ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { getRequesterTicket } from '../../shared/api/tickets';
import type { TicketRecord } from '../../shared/api/types';
import { useAuth } from '../../shared/auth/useAuth';
import {
  IMPACT_METADATA,
  PRIORITY_METADATA,
  STATUS_METADATA,
  URGENCY_METADATA,
} from './ticketMetadata';
import RequesterTicketJourney from './RequesterTicketJourney';

export default function RequesterTicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [ticket, setTicket] = useState<TicketRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!id) return;
    let active = true;
    getRequesterTicket(id)
      .then((result) => {
        if (active) {
          setTicket(result);
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : 'Không tải được yêu cầu.',
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, retry]);

  if (loading) {
    return (
      <div className="requester-loading">
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <Result
        status="warning"
        title="Không tải được yêu cầu"
        subTitle={error}
        extra={
          <Space>
            <Button
              onClick={() => {
                setLoading(true);
                setRetry((value) => value + 1);
              }}
            >
              Thử lại
            </Button>
            <Button onClick={() => navigate('/requester/tickets')}>
              Về danh sách
            </Button>
          </Space>
        }
      />
    );
  }

  if (!ticket) {
    return (
      <Result
        status="404"
        title="Không tìm thấy yêu cầu"
        extra={
          <Button onClick={() => navigate('/requester/tickets')}>
            Về danh sách
          </Button>
        }
      />
    );
  }

  if (ticket.requester.id !== user?.id) {
    return (
      <Result
        status="403"
        title="Không có quyền xem yêu cầu này"
        extra={
          <Button onClick={() => navigate('/requester/tickets')}>
            Về danh sách
          </Button>
        }
      />
    );
  }

  const status = STATUS_METADATA[ticket.status];
  const priority = PRIORITY_METADATA[ticket.priority];
  const impactMeta = IMPACT_METADATA[ticket.impact];
  const urgencyMeta = URGENCY_METADATA[ticket.urgency];

  return (
    <div className="requester-page">
      <div className="requester-heading">
        <div>
          <Typography.Text className="requester-eyebrow-text">
            REQUESTER / CHI TIẾT YÊU CẦU
          </Typography.Text>
          <Typography.Title level={2}>Chi tiết {ticket.code}</Typography.Title>
          <Typography.Text type="secondary">{ticket.title}</Typography.Text>
        </div>
        <Space wrap>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              setLoading(true);
              setRetry((value) => value + 1);
            }}
          >
            Làm mới
          </Button>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/requester/tickets')}
          >
            Quay lại danh sách
          </Button>
        </Space>
      </div>

      <Alert
        showIcon
        type={
          ticket.status === 'WAITING_REQUESTER'
            ? 'warning'
            : ticket.status === 'REJECTED'
              ? 'error'
              : ticket.status === 'RESOLVED'
                ? 'success'
                : 'info'
        }
        title={`Trạng thái hiện tại: ${status.label}`}
        description={status.description}
      />

      {/* Thanh tiến trình vòng đời Ticket */}
      <Card className="requester-card" title="Tiến trình xử lý yêu cầu">
        <Steps
          size="small"
          current={status.stepIndex}
          status={
            ticket.status === 'REJECTED'
              ? 'error'
              : ticket.status === 'CLOSED'
                ? 'finish'
                : 'process'
          }
          items={[
            { title: 'Mới tạo', description: 'Gửi yêu cầu' },
            {
              title: ticket.status === 'REJECTED' ? 'Từ chối' : 'Đã phân loại',
              description: 'Xác định ưu tiên',
            },
            { title: 'Đã phân công', description: 'Giao kỹ thuật viên' },
            {
              title:
                ticket.status === 'WAITING_REQUESTER'
                  ? 'Chờ phản hồi'
                  : 'Đang xử lý',
              description: 'Khắc phục sự cố',
            },
            { title: 'Đã giải quyết', description: 'Chờ xác nhận' },
            { title: 'Đã đóng', description: 'Hoàn tất' },
          ]}
        />
      </Card>

      <Row gutter={[20, 20]}>
        <Col xs={24} lg={15}>
          <Card
            className="requester-card"
            title="Thông tin sự cố"
            extra={<Tag color={priority.color}>{priority.label}</Tag>}
          >
            <Descriptions bordered column={{ xs: 1, sm: 2 }} size="small">
              <Descriptions.Item label="Mã yêu cầu">
                <Typography.Text strong>{ticket.code}</Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="Danh mục">
                {ticket.category.name}
              </Descriptions.Item>
              <Descriptions.Item label="Người gửi">
                {ticket.requester.fullName}
              </Descriptions.Item>
              <Descriptions.Item label="Người xử lý">
                {ticket.assignee?.fullName ?? 'Chưa phân công'}
              </Descriptions.Item>
              <Descriptions.Item label="Mức độ ảnh hưởng">
                <Tag color={impactMeta.color}>{impactMeta.label}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Mức độ khẩn cấp">
                <Tag color={urgencyMeta.color}>{urgencyMeta.label}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Ngày tạo">
                {new Date(ticket.createdAt).toLocaleString('vi-VN')}
              </Descriptions.Item>
              <Descriptions.Item label="Cập nhật gần nhất">
                {new Date(ticket.updatedAt).toLocaleString('vi-VN')}
              </Descriptions.Item>
              {ticket.resolvedAt && (
                <Descriptions.Item label="Thời điểm giải quyết">
                  {new Date(ticket.resolvedAt).toLocaleString('vi-VN')}
                </Descriptions.Item>
              )}
              {ticket.closedAt && (
                <Descriptions.Item label="Thời điểm đóng">
                  {new Date(ticket.closedAt).toLocaleString('vi-VN')}
                </Descriptions.Item>
              )}
            </Descriptions>

            <Typography.Title level={5} style={{ marginTop: 24 }}>
              Mô tả vấn đề
            </Typography.Title>
            <Typography.Paragraph className="requester-description">
              {ticket.description}
            </Typography.Paragraph>
          </Card>

          {ticket.resolutionNote &&
            (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') && (
              <Card
                className="requester-card"
                title="Nội dung giải pháp từ kỹ thuật viên"
                style={{ marginTop: 20 }}
              >
                <Typography.Paragraph className="requester-description">
                  {ticket.resolutionNote}
                </Typography.Paragraph>
              </Card>
            )}
        </Col>

        <Col xs={24} lg={9}>
          <Card className="requester-card" title="Tiến độ & Thời hạn SLA">
            <div className="requester-summary-list">
              <div className="requester-summary-item">
                <Typography.Text type="secondary">Trạng thái</Typography.Text>
                <Tag color={status.color}>{status.label}</Tag>
              </div>
              <div className="requester-summary-item">
                <Typography.Text type="secondary">Mức ưu tiên</Typography.Text>
                <Tag color={priority.color}>{priority.shortLabel}</Tag>
              </div>
              <div className="requester-summary-item">
                <Typography.Text type="secondary">
                  Kỹ thuật viên phụ trách
                </Typography.Text>
                <Typography.Text strong>
                  {ticket.assignee?.fullName ?? 'Chưa phân công'}
                </Typography.Text>
              </div>
              <div className="requester-summary-item">
                <Typography.Text type="secondary">
                  Cam kết phản hồi đầu tiên
                </Typography.Text>
                <Typography.Text strong>{priority.responseSla}</Typography.Text>
              </div>
              <div className="requester-summary-item">
                <Typography.Text type="secondary">
                  Cam kết thời gian giải quyết
                </Typography.Text>
                <Typography.Text strong>
                  {priority.resolutionSla}
                </Typography.Text>
              </div>
            </div>

            <Typography.Paragraph
              type="secondary"
              style={{ marginTop: 14, marginBottom: 4 }}
            >
              {status.description}
            </Typography.Paragraph>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Cập nhật gần nhất:{' '}
              {new Date(ticket.updatedAt).toLocaleString('vi-VN')}
            </Typography.Text>
          </Card>
        </Col>
      </Row>

      <RequesterTicketJourney
        ticket={ticket}
        onUpdated={() => setRetry((value) => value + 1)}
      />
    </div>
  );
}
