import { useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Empty, Row, Spin, Statistic, Typography } from 'antd';
import { ArrowRightOutlined, FileAddOutlined, RobotOutlined } from '@ant-design/icons';
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
  const [counts, setCounts] = useState({ new: 0, inProgress: 0, resolved: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      getTickets({ scope: 'requested', limit: 5 }),
      getRequesterTicketCount({ status: 'NEW' }),
      getRequesterTicketCount({ status: 'IN_PROGRESS' }),
      getRequesterTicketCount({ status: 'RESOLVED' }),
    ]).then(([recent, newlyCreated, inProgress, resolved]) => {
      if (active) {
        setTickets(recent);
        setCounts({ new: newlyCreated, inProgress, resolved });
      }
    })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Không tải được yêu cầu.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user?.id]);

  return <div className="requester-page">
    <div className="requester-heading"><div><Typography.Text className="requester-eyebrow-text">REQUESTER / HOME</Typography.Text><Typography.Title level={2}>Xin chào, {user?.fullName ?? 'bạn'} 👋</Typography.Title><Typography.Text type="secondary">Hôm nay SmartDesk có thể giúp gì cho bạn?</Typography.Text></div><Button type="primary" icon={<FileAddOutlined />} onClick={() => navigate('/requester/tickets/new')}>Tạo yêu cầu mới</Button></div>
    <Card className="requester-hero">
      <div><span className="requester-eyebrow">SMARTDESK AI SUPPORT</span><Typography.Title level={2}>Gặp sự cố IT? SmartDesk luôn sẵn sàng hỗ trợ.</Typography.Title><Typography.Paragraph>Mô tả sự cố để AI gợi ý các bước kiểm tra ban đầu, rồi tạo yêu cầu nếu vẫn cần bộ phận IT hỗ trợ.</Typography.Paragraph><Button onClick={() => navigate('/requester/ai')}>Nhờ AI hỗ trợ <ArrowRightOutlined /></Button></div><RobotOutlined className="requester-hero-icon" />
    </Card>
    {!loading && !error && <><Typography.Title level={5}>Yêu cầu hỗ trợ của bạn</Typography.Title><Row gutter={[16, 16]} className="requester-stats">
      <Col xs={24} sm={8}><Card><Statistic title="Chờ tiếp nhận" value={counts.new} /></Card></Col>
      <Col xs={24} sm={8}><Card><Statistic title="Đang xử lý" value={counts.inProgress} /></Card></Col>
      <Col xs={24} sm={8}><Card><Statistic title="Đã giải quyết" value={counts.resolved} /></Card></Col>
    </Row></>}
    <Card className="requester-card" title="Yêu cầu gần đây" extra={<Button type="link" onClick={() => navigate('/requester/tickets')}>Xem tất cả <ArrowRightOutlined /></Button>}>
      {error && <Alert showIcon type="error" title="Không tải được yêu cầu" description={error} />}
      {loading ? <div className="requester-loading"><Spin /></div> : tickets.length === 0 && !error
        ? <Empty description="Bạn chưa có yêu cầu hỗ trợ nào"><Button type="primary" onClick={() => navigate('/requester/tickets/new')}>Tạo yêu cầu đầu tiên</Button></Empty>
        : !error && <TicketTable tickets={tickets.slice(0, 5).map(toTicketRow)} emptyText="Chưa có yêu cầu hỗ trợ" onViewDetail={(ticket) => navigate(`/requester/tickets/${ticket.id}`)} />}
    </Card>
  </div>;
}
