import { useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Empty, Row, Spin, Statistic, Typography } from 'antd';
import { ArrowRightOutlined, FileAddOutlined, RobotOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getTickets } from '../../shared/api/tickets';
import type { TicketRecord } from '../../shared/api/types';
import TicketTable from '../../shared/components/tickets/TicketTable';
import { toTicketRow } from '../../shared/components/tickets/ticketAdapter';

export default function RequesterHomePage() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<TicketRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getTickets().then((result) => { if (active) setTickets(result); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Không tải được yêu cầu.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return <div className="requester-page">
    <div className="requester-heading"><div><Typography.Title level={2}>Xin chào, bạn cần hỗ trợ gì?</Typography.Title><Typography.Text type="secondary">Gửi yêu cầu và theo dõi tiến độ hỗ trợ IT tại một nơi.</Typography.Text></div><Button type="primary" icon={<FileAddOutlined />} onClick={() => navigate('/requester/tickets/new')}>Tạo yêu cầu</Button></div>
    <Card className="requester-hero">
      <div><span className="requester-eyebrow">SMARTDESK AI SUPPORT</span><Typography.Title level={2}>Gặp sự cố IT? SmartDesk luôn sẵn sàng hỗ trợ.</Typography.Title><Typography.Paragraph>Mô tả sự cố để AI gợi ý các bước kiểm tra ban đầu, rồi tạo yêu cầu nếu vẫn cần bộ phận IT hỗ trợ.</Typography.Paragraph><Button onClick={() => navigate('/requester/ai')}>Nhờ AI hỗ trợ <ArrowRightOutlined /></Button></div><RobotOutlined className="requester-hero-icon" />
    </Card>
    {!loading && !error && <Row gutter={[16, 16]} className="requester-stats">
      <Col xs={24} sm={8}><Card><Statistic title="Tất cả yêu cầu" value={tickets.length} /></Card></Col>
      <Col xs={24} sm={8}><Card><Statistic title="Đang xử lý" value={tickets.filter((ticket) => ['ASSIGNED', 'IN_PROGRESS', 'WAITING_REQUESTER'].includes(ticket.status)).length} /></Card></Col>
      <Col xs={24} sm={8}><Card><Statistic title="Đã hoàn tất" value={tickets.filter((ticket) => ['RESOLVED', 'CLOSED'].includes(ticket.status)).length} /></Card></Col>
    </Row>}
    <Card className="requester-card" title="Yêu cầu gần đây" extra={<Button type="link" onClick={() => navigate('/requester/tickets')}>Xem tất cả <ArrowRightOutlined /></Button>}>
      {error && <Alert showIcon type="error" message="Không tải được yêu cầu" description={error} />}
      {loading ? <div className="requester-loading"><Spin /></div> : tickets.length === 0 && !error
        ? <Empty description="Bạn chưa có yêu cầu hỗ trợ nào"><Button type="primary" onClick={() => navigate('/requester/tickets/new')}>Tạo yêu cầu đầu tiên</Button></Empty>
        : !error && <TicketTable tickets={tickets.slice(0, 5).map(toTicketRow)} emptyText="Chưa có yêu cầu hỗ trợ" />}
    </Card>
  </div>;
}
