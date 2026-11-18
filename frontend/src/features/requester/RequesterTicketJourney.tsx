import { useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Empty, Input, Popconfirm, Row, Spin, Tag, Timeline, Typography } from 'antd';
import {
  addRequesterTicketComment,
  closeRequesterTicket,
  getRequesterTicketActivity,
  reopenRequesterTicket,
} from '../../shared/api/tickets';
import type { TicketActivity, TicketRecord, TicketStatus } from '../../shared/api/types';
import { STATUS_METADATA } from './ticketMetadata';

const REOPEN_WINDOW_MS = 72 * 60 * 60 * 1000;
const COMMENTABLE_STATUSES: TicketStatus[] = ['NEW', 'TRIAGED', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_REQUESTER'];

function formatDate(value: string): string {
  return new Date(value).toLocaleString('vi-VN');
}

export default function RequesterTicketJourney({ ticket, onUpdated }: {
  ticket: TicketRecord;
  onUpdated: () => void;
}) {
  const [activity, setActivity] = useState<TicketActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [comment, setComment] = useState('');
  const [reopenReason, setReopenReason] = useState('');
  const [retry, setRetry] = useState(0);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const initial = setTimeout(() => setNow(Date.now()), 0);
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => { clearTimeout(initial); clearInterval(timer); };
  }, []);

  useEffect(() => {
    let active = true;
    getRequesterTicketActivity(ticket.id).then((items) => {
      if (active) { setActivity(items); setLoadError(null); }
    }).catch((cause: unknown) => {
      if (active) setLoadError(cause instanceof Error ? cause.message : 'Không tải được lịch sử.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [ticket.id, ticket.version, retry]);

  async function runAction(action: () => Promise<unknown>, onSuccess?: () => void) {
    setBusy(true);
    setActionError(null);
    try {
      await action();
      onSuccess?.();
      onUpdated();
    } catch (cause) {
      setActionError(`${cause instanceof Error ? cause.message : 'Thao tác không thành công.'} Vui lòng tải lại yêu cầu nếu trạng thái vừa thay đổi.`);
      onUpdated();
    } finally {
      setBusy(false);
    }
  }

  const canComment = COMMENTABLE_STATUSES.includes(ticket.status);
  const canReopen = ticket.status === 'RESOLVED' && ticket.resolvedAt !== null && now !== null
    && now < new Date(ticket.resolvedAt).getTime() + REOPEN_WINDOW_MS;
  const deadline = ticket.resolvedAt
    ? new Date(new Date(ticket.resolvedAt).getTime() + REOPEN_WINDOW_MS).toISOString()
    : null;
  const comments = activity.filter((item) => item.type === 'COMMENT');
  const milestones: { key: string; at: string; title: string; detail?: string }[] = [
    { key: 'created', at: ticket.createdAt, title: 'Yêu cầu được tạo' },
    ...activity.filter((item) => item.type === 'STATUS' && item.toStatus).map((item) => ({
      key: item.id,
      at: item.createdAt,
      title: STATUS_METADATA[item.toStatus!].label,
      detail: item.content ?? undefined,
    })),
  ];
  if (ticket.resolvedAt && !activity.some((item) => item.toStatus === 'RESOLVED')) {
    milestones.push({ key: 'resolved', at: ticket.resolvedAt, title: 'Đã giải quyết' });
  }
  if (ticket.closedAt && !activity.some((item) => item.toStatus === 'CLOSED')) {
    milestones.push({ key: 'closed', at: ticket.closedAt, title: 'Đã đóng' });
  }
  milestones.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return <Row gutter={[20, 20]}>
    <Col xs={24} lg={15}>
      <Card className="requester-card" title="Trao đổi công khai với bộ phận IT">
        <Typography.Paragraph type="secondary">Chỉ các bình luận công khai hiển thị tại đây. Ghi chú nội bộ của IT không được chia sẻ với người gửi.</Typography.Paragraph>
        {loading ? <Spin /> : loadError ? <Alert type="error" showIcon title={loadError}
          action={<Button size="small" onClick={() => { setLoading(true); setRetry((value) => value + 1); }}>Thử lại</Button>} />
          : comments.length === 0 ? <Empty description="Chưa có trao đổi công khai" />
            : <div className="requester-comments">{comments.map((item) => <div className="requester-comment" key={item.id}>
                <div><strong>{item.actor?.fullName ?? 'Bộ phận IT'}</strong> <Typography.Text type="secondary">· {formatDate(item.createdAt)}</Typography.Text></div>
                <Typography.Paragraph className="requester-description">{item.content}</Typography.Paragraph>
              </div>)}</div>}
        {canComment && <div className="requester-comment-form">
          {ticket.status === 'WAITING_REQUESTER' && <Alert type="info" showIcon title="Bộ phận IT đang chờ thông tin bổ sung từ bạn." />}
          <Input.TextArea value={comment} onChange={(event) => setComment(event.target.value)} rows={4} maxLength={2000}
            placeholder="Nhập phản hồi hoặc thông tin bổ sung. Không gửi mật khẩu hay thông tin nhạy cảm." />
          <Button type="primary" loading={busy} disabled={!comment.trim()} onClick={() => void runAction(
            () => addRequesterTicketComment(ticket.id, comment.trim(), ticket.version),
            () => setComment(''),
          )}>Gửi phản hồi</Button>
        </div>}
        {!canComment && <Typography.Text type="secondary">{ticket.status === 'RESOLVED'
          ? 'Nếu sự cố vẫn còn, hãy mở lại yêu cầu trong thời hạn cho phép để tiếp tục trao đổi.'
          : 'Yêu cầu đã kết thúc trao đổi.'}</Typography.Text>}
      </Card>
    </Col>
    <Col xs={24} lg={9}>
      <Card className="requester-card" title="Lịch sử xử lý">
        {loading ? <Spin /> : loadError ? <Alert type="error" showIcon title="Không tải được lịch sử xử lý" />
          : <Timeline items={milestones.map((item) => ({
              content: <div><strong>{item.title}</strong><div><Typography.Text type="secondary">{formatDate(item.at)}</Typography.Text></div>
                {item.detail && <Typography.Paragraph className="requester-description">{item.detail}</Typography.Paragraph>}</div>,
            }))} />}
        <Typography.Text type="secondary">Các mốc trước khi hệ thống ghi lịch sử chỉ hiển thị khi Ticket có thời điểm tương ứng.</Typography.Text>
      </Card>
      {ticket.status === 'RESOLVED' && <Card className="requester-card" title="Xác nhận kết quả">
        {actionError && <Alert type="error" showIcon title={actionError} className="requester-action-alert" />}
        <Typography.Paragraph>Nếu sự cố đã được xử lý, bạn có thể xác nhận đóng yêu cầu.</Typography.Paragraph>
        <Popconfirm title="Xác nhận đóng yêu cầu?" description="Yêu cầu đã đóng không thể mở lại từ trang này."
          okText="Đóng yêu cầu" cancelText="Hủy" onConfirm={() => void runAction(() => closeRequesterTicket(ticket.id, ticket.version))}>
          <Button type="primary" loading={busy}>Xác nhận hoàn tất</Button>
        </Popconfirm>
        {deadline && <Typography.Paragraph type="secondary" className="requester-deadline">
          Thời hạn mở lại: {formatDate(deadline)}. Sau thời điểm này, hệ thống tự đóng yêu cầu.
        </Typography.Paragraph>}
        {canReopen && <div className="requester-reopen-form">
          <Typography.Text strong>Sự cố vẫn còn?</Typography.Text>
          <Input.TextArea value={reopenReason} onChange={(event) => setReopenReason(event.target.value)} rows={3}
            maxLength={2000} placeholder="Mô tả lý do cần mở lại (ít nhất 3 ký tự)" />
          <Button loading={busy} disabled={reopenReason.trim().length < 3} onClick={() => void runAction(
            () => reopenRequesterTicket(ticket.id, ticket.version, reopenReason.trim()),
            () => setReopenReason(''),
          )}>Mở lại yêu cầu</Button>
        </div>}
        {now !== null && !canReopen && <Tag color="default">Đã hết thời hạn mở lại</Tag>}
      </Card>}
      {ticket.status !== 'RESOLVED' && actionError && <Alert type="error" showIcon title={actionError} />}
    </Col>
  </Row>;
}
