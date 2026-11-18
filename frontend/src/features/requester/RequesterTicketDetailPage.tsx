import { useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Descriptions, Result, Row, Spin, Tag, Typography } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { getRequesterTicket } from '../../shared/api/tickets';
import type { TicketRecord } from '../../shared/api/types';
import { useAuth } from '../../shared/auth/useAuth';
import { PRIORITY_METADATA, STATUS_METADATA } from './ticketMetadata';
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
    getRequesterTicket(id).then((result) => {
      if (active) { setTicket(result); setError(null); }
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : 'Không tải được yêu cầu.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [id, retry]);

  if (loading) return <div className="requester-loading"><Spin size="large" /></div>;
  if (error) return <Result status="warning" title="Không tải được yêu cầu" subTitle={error} extra={<><Button onClick={() => { setLoading(true); setRetry((value) => value + 1); }}>Thử lại</Button><Button onClick={() => navigate('/requester/tickets')}>Về danh sách</Button></>} />;
  if (!ticket) return <Result status="404" title="Không tìm thấy yêu cầu" extra={<Button onClick={() => navigate('/requester/tickets')}>Về danh sách</Button>} />;
  if (ticket.requester.id !== user?.id) return <Result status="403" title="Không có quyền xem yêu cầu này" extra={<Button onClick={() => navigate('/requester/tickets')}>Về danh sách</Button>} />;

  const status = STATUS_METADATA[ticket.status];
  const priority = PRIORITY_METADATA[ticket.priority];
  return <div className="requester-page">
    <div className="requester-heading">
      <div>
        <Typography.Text className="requester-eyebrow-text">CHI TIẾT YÊU CẦU</Typography.Text>
        <Typography.Title level={2}>Chi tiết {ticket.code}</Typography.Title>
        <Typography.Text type="secondary">{ticket.title}</Typography.Text>
      </div>
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/requester/tickets')}>Quay lại danh sách</Button>
    </div>
    <Alert showIcon type="info" title={status.label} description={status.description} />
    <Row gutter={[20, 20]}>
      <Col xs={24} lg={15}>
        <Card className="requester-card" title="Thông tin sự cố" extra={<Tag color={priority.color}>{priority.label}</Tag>}>
          <Descriptions bordered column={{ xs: 1, sm: 2 }} size="small">
            <Descriptions.Item label="Mã yêu cầu">{ticket.code}</Descriptions.Item>
            <Descriptions.Item label="Danh mục">{ticket.category.name}</Descriptions.Item>
            <Descriptions.Item label="Người gửi">{ticket.requester.fullName}</Descriptions.Item>
            <Descriptions.Item label="Người xử lý">{ticket.assignee?.fullName ?? 'Chưa phân công'}</Descriptions.Item>
            <Descriptions.Item label="Mức ảnh hưởng">{ticket.impact}</Descriptions.Item>
            <Descriptions.Item label="Tính khẩn cấp">{ticket.urgency}</Descriptions.Item>
            <Descriptions.Item label="Ngày tạo">{new Date(ticket.createdAt).toLocaleString('vi-VN')}</Descriptions.Item>
            <Descriptions.Item label="Cập nhật gần nhất">{new Date(ticket.updatedAt).toLocaleString('vi-VN')}</Descriptions.Item>
          </Descriptions>
          <Typography.Title level={5} style={{ marginTop: 24 }}>Mô tả vấn đề</Typography.Title>
          <Typography.Paragraph className="requester-description">{ticket.description}</Typography.Paragraph>
        </Card>
        {ticket.resolutionNote && (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') && <Card className="requester-card" title="Nội dung giải pháp">
          <Typography.Paragraph className="requester-description">{ticket.resolutionNote}</Typography.Paragraph>
        </Card>}
      </Col>
      <Col xs={24} lg={9}>
        <Card className="requester-card" title="Tiến độ hiện tại">
          <Typography.Paragraph><strong>Trạng thái:</strong> <Tag color={status.color}>{status.label}</Tag></Typography.Paragraph>
          <Typography.Paragraph type="secondary">{status.description}</Typography.Paragraph>
          <Typography.Text type="secondary">Cập nhật gần nhất: {new Date(ticket.updatedAt).toLocaleString('vi-VN')}</Typography.Text>
        </Card>
      </Col>
    </Row>
    <RequesterTicketJourney ticket={ticket} onUpdated={() => setRetry((value) => value + 1)} />
  </div>;
}
