import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Row,
  Space,
  Spin,
  Statistic,
  Tag,
  Typography,
} from 'antd';
import {
  ArrowRightOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  FileAddOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getRequesterTicketCount, getTickets } from '../../shared/api/tickets';
import type { TicketRecord } from '../../shared/api/types';
import TicketTable from '../../shared/components/tickets/TicketTable';
import { toTicketRow } from '../../shared/components/tickets/ticketAdapter';
import { useAuth } from '../../shared/auth/useAuth';

export default function RequesterHomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tickets, setTickets] = useState<TicketRecord[]>([]);
  const [counts, setCounts] = useState({
    total: 0,
    waitingRequester: 0,
    inProgress: 0,
    resolved: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([
      getTickets({ scope: 'requested', limit: 5 }),
      getRequesterTicketCount({}),
      getRequesterTicketCount({ status: 'WAITING_REQUESTER' }),
      getRequesterTicketCount({ status: 'IN_PROGRESS' }),
      getRequesterTicketCount({ status: 'RESOLVED' }),
    ])
      .then(([recent, total, waitingRequester, inProgress, resolved]) => {
        if (active) {
          setTickets(recent);
          setCounts({ total, waitingRequester, inProgress, resolved });
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : 'Không tải được yêu cầu hỗ trợ.',
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user?.id, retry]);

  return (
    <div className="requester-page">
      <div className="requester-heading">
        <div>
          <Typography.Text className="requester-eyebrow-text">
            REQUESTER / TRANG CHỦ
          </Typography.Text>
          <Typography.Title level={2}>
            Xin chào, {user?.fullName ?? 'bạn'} 👋
          </Typography.Title>
          <Typography.Text type="secondary">
            Hôm nay SmartDesk có thể giúp gì cho bạn? Bạn có thể hỏi trợ lý AI
            hoặc gửi yêu cầu trực tiếp tới bộ phận IT.
          </Typography.Text>
        </div>
        <Space wrap>
          <Button
            icon={<RobotOutlined />}
            onClick={() => navigate('/requester/ai')}
          >
            Nhờ AI hỗ trợ
          </Button>
          <Button
            type="primary"
            icon={<FileAddOutlined />}
            onClick={() => navigate('/requester/tickets/new')}
          >
            Tạo yêu cầu hỗ trợ
          </Button>
        </Space>
      </div>

      {/* Hero banner với 2 hành động trọng tâm theo thiết kế SmartDesk */}
      <Card className="requester-hero">
        <div>
          <span className="requester-eyebrow">SMARTDESK IT SERVICE DESK</span>
          <Typography.Title level={2}>
            Gặp sự cố IT? SmartDesk luôn sẵn sàng hỗ trợ bạn.
          </Typography.Title>
          <Typography.Paragraph>
            Mô tả sự cố bằng ngôn ngữ tự nhiên để nhận các bước kiểm tra an toàn
            từ AI, hoặc tạo ngay yêu cầu hỗ trợ để kỹ thuật viên IT tiếp nhận và
            xử lý.
          </Typography.Paragraph>
          <div className="requester-hero-actions">
            <Button
              size="large"
              icon={<RobotOutlined />}
              className="requester-hero-btn-primary"
              onClick={() => navigate('/requester/ai')}
            >
              Nhờ AI hỗ trợ <ArrowRightOutlined />
            </Button>
            <Button
              size="large"
              icon={<FileAddOutlined />}
              className="requester-hero-btn-secondary"
              onClick={() => navigate('/requester/tickets/new')}
            >
              Tạo yêu cầu hỗ trợ ngay
            </Button>
          </div>
        </div>
        <RobotOutlined className="requester-hero-icon" />
      </Card>

      {/* Hai thẻ lựa chọn nhanh */}
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card
            className="requester-action-card"
            onClick={() => navigate('/requester/ai')}
          >
            <Space align="start" size={14}>
              <Tag color="blue" style={{ padding: '6px 10px', fontSize: 16 }}>
                <RobotOutlined />
              </Tag>
              <div>
                <Typography.Title level={5} style={{ margin: '0 0 4px' }}>
                  1. Chẩn đoán nhanh cùng Trợ lý AI
                </Typography.Title>
                <Typography.Paragraph
                  type="secondary"
                  style={{ marginBottom: 8 }}
                >
                  Nhận hướng dẫn khắc phục ban đầu cho sự cố mạng, máy in, phần
                  mềm và tự động chuẩn bị bản nháp Ticket nếu vẫn cần IT hỗ trợ.
                </Typography.Paragraph>
                <Typography.Text strong style={{ color: '#2563eb' }}>
                  Mở Trợ lý AI <ArrowRightOutlined />
                </Typography.Text>
              </div>
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card
            className="requester-action-card"
            onClick={() => navigate('/requester/tickets/new')}
          >
            <Space align="start" size={14}>
              <Tag
                color="geekblue"
                style={{ padding: '6px 10px', fontSize: 16 }}
              >
                <FileAddOutlined />
              </Tag>
              <div>
                <Typography.Title level={5} style={{ margin: '0 0 4px' }}>
                  2. Gửi yêu cầu trực tiếp cho bộ phận IT
                </Typography.Title>
                <Typography.Paragraph
                  type="secondary"
                  style={{ marginBottom: 8 }}
                >
                  Điền trực tiếp biểu mẫu sự cố khi bạn đã rõ nguyên nhân hoặc
                  cần kỹ thuật viên can thiệp ngay mà không cần qua bước hỏi AI.
                </Typography.Paragraph>
                <Typography.Text strong style={{ color: '#2563eb' }}>
                  Tạo yêu cầu hỗ trợ <ArrowRightOutlined />
                </Typography.Text>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Nhắc nhở khi có Ticket cần Requester phản hồi hoặc xác nhận */}
      {!loading &&
        !error &&
        (counts.waitingRequester > 0 || counts.resolved > 0) && (
          <Alert
            type="warning"
            showIcon
            title="Bạn có yêu cầu hỗ trợ cần thao tác"
            description={
              <Space wrap>
                {counts.waitingRequester > 0 && (
                  <span>
                    • <strong>{counts.waitingRequester} yêu cầu</strong> đang chờ
                    bạn bổ sung thông tin cho kỹ thuật viên.
                  </span>
                )}
                {counts.resolved > 0 && (
                  <span>
                    • <strong>{counts.resolved} yêu cầu</strong> đã được giải
                    quyết, chờ bạn xác nhận hoàn tất hoặc mở lại trong 72 giờ.
                  </span>
                )}
              </Space>
            }
            action={
              <Button
                size="small"
                type="primary"
                onClick={() => navigate('/requester/tickets')}
              >
                Xem danh sách
              </Button>
            }
          />
        )}

      {/* Thống kê yêu cầu cá nhân */}
      {!loading && !error && (
        <>
          <Typography.Title level={5} style={{ marginBottom: -4 }}>
            Thống kê yêu cầu hỗ trợ của bạn
          </Typography.Title>
          <Row gutter={[16, 16]} className="requester-stats">
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="Tổng yêu cầu đã gửi"
                  value={counts.total}
                  suffix="yêu cầu"
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="Đang được kỹ thuật xử lý"
                  value={counts.inProgress}
                  prefix={<ClockCircleOutlined style={{ color: '#2563eb' }} />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="Chờ bạn bổ sung thông tin"
                  value={counts.waitingRequester}
                  prefix={
                    <ExclamationCircleOutlined style={{ color: '#d97706' }} />
                  }
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="Đã giải quyết (Chờ xác nhận)"
                  value={counts.resolved}
                  prefix={<CheckCircleOutlined style={{ color: '#16a34a' }} />}
                />
              </Card>
            </Col>
          </Row>
        </>
      )}

      {/* Bảng yêu cầu gần đây */}
      <Card
        className="requester-card"
        title="Yêu cầu hỗ trợ gần đây"
        extra={
          <Button type="link" onClick={() => navigate('/requester/tickets')}>
            Xem tất cả <ArrowRightOutlined />
          </Button>
        }
      >
        {error && (
          <Alert
            showIcon
            type="error"
            title="Không tải được yêu cầu"
            description={error}
            action={
              <Button
                size="small"
                onClick={() => {
                  setLoading(true);
                  setRetry((value) => value + 1);
                }}
              >
                Thử lại
              </Button>
            }
          />
        )}
        {loading ? (
          <div className="requester-loading">
            <Spin />
          </div>
        ) : tickets.length === 0 && !error ? (
          <Empty description="Bạn chưa có yêu cầu hỗ trợ nào">
            <Space wrap>
              <Button
                icon={<RobotOutlined />}
                onClick={() => navigate('/requester/ai')}
              >
                Hỏi Trợ lý AI
              </Button>
              <Button
                type="primary"
                icon={<FileAddOutlined />}
                onClick={() => navigate('/requester/tickets/new')}
              >
                Tạo yêu cầu đầu tiên
              </Button>
            </Space>
          </Empty>
        ) : (
          !error && (
            <TicketTable
              tickets={tickets.slice(0, 5).map(toTicketRow)}
              emptyText="Chưa có yêu cầu hỗ trợ"
              onViewDetail={(ticket) =>
                navigate(`/requester/tickets/${ticket.id}`)
              }
            />
          )
        )}
      </Card>
    </div>
  );
}
