import { useEffect, useState } from 'react';
import { Alert, Button, Descriptions, Input, Spin, Timeline, Typography } from 'antd';
import { CheckOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import {
  addTechnicianComment,
  addTechnicianNote,
  getAssignedTicket,
  getTechnicianTicketActivity,
  requestTicketInformation,
  resolveAssignedTicket,
  startAssignedTicket,
} from '../../shared/api/tickets';
import type { TicketActivity, TicketRecord } from '../../shared/api/types';
import { STATUS_METADATA } from '../../shared/components/tickets/ticketMetadata';
import { INTERNAL_PATHS } from '../../layouts/internalPaths';
import './TechnicianWorkspace.css';

function formatDate(value: string) {
  return new Date(value).toLocaleString('vi-VN');
}

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<TicketRecord | null>(null);
  const [activity, setActivity] = useState<TicketActivity[]>([]);
  const [loading, setLoading] = useState(Boolean(id));
  const [error, setError] = useState<string | null>(id ? null : 'Mã Ticket không hợp lệ.');
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [publicReply, setPublicReply] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [informationRequest, setInformationRequest] = useState('');
  const [resolution, setResolution] = useState('');

  useEffect(() => {
    if (!id) return;
    let active = true;
    Promise.all([getAssignedTicket(id), getTechnicianTicketActivity(id)])
      .then(([record, history]) => {
        if (active) {
          setTicket(record);
          setActivity(history);
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Không tải được Ticket');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [id, revision]);

  async function runAction(action: () => Promise<unknown>, clearForm?: () => void) {
    setBusy(true);
    setActionError(null);
    try {
      await action();
      clearForm?.();
      setRevision((value) => value + 1);
    } catch (cause) {
      setActionError(`${cause instanceof Error ? cause.message : 'Thao tác không thành công.'} Tải lại Ticket nếu trạng thái vừa thay đổi.`);
      setRevision((value) => value + 1);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="tech-card" style={{ padding: 32, textAlign: 'center' }}><Spin size="large" /></div>;

  if (error || !ticket) {
    return (
      <main className="tech-page">
        <div className="tech-card" style={{ padding: 24 }}>
          <h2>Không tải được Ticket</h2>
          <p>{error ?? 'Ticket không tồn tại hoặc không được phân công cho bạn.'}</p>
          <button className="tech-secondary-button" type="button" onClick={() => navigate(INTERNAL_PATHS.technicianTickets)}>← Công việc được giao</button>
        </div>
      </main>
    );
  }

  const canWork = ticket.status === 'IN_PROGRESS';
  const statusMeta = STATUS_METADATA[ticket.status];
  const timelineItems = activity.map((item) => {
    const internal = item.visibility === 'INTERNAL';
    const title = item.type === 'STATUS'
      ? item.toStatus ? STATUS_METADATA[item.toStatus].label : 'Cập nhật trạng thái'
      : internal ? 'Ghi chú nội bộ' : 'Phản hồi công khai';
    return {
      color: internal ? 'gray' : item.type === 'STATUS' ? 'blue' : 'green',
      children: (
        <div>
          <Typography.Text strong>{title}</Typography.Text>
          <div><Typography.Text type="secondary">{item.actor?.fullName ?? 'Hệ thống'} · {formatDate(item.createdAt)}</Typography.Text></div>
          {item.content && <Typography.Paragraph style={{ marginTop: 8, marginBottom: 0 }}>{item.content}</Typography.Paragraph>}
        </div>
      ),
    };
  });

  return (
    <main className="tech-page">
      {actionError && <Alert type="error" showIcon message="Thao tác chưa hoàn tất" description={actionError} style={{ marginBottom: 16 }} />}

      <div className="tech-detail-title-row">
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <span className="tech-eyebrow">KỸ THUẬT VIÊN / XỬ LÝ TICKET</span>
            <h1>Xử lý {ticket.code}</h1>
            <p>{ticket.title}</p>
          </div>
          <button className="tech-secondary-button" type="button" onClick={() => navigate(INTERNAL_PATHS.technicianTickets)}>← Công việc được giao</button>
        </div>
      </div>

      <div className="tech-detail-grid">
        <div>
          <section className="tech-card tech-progress-card">
            <header className="tech-card-header" style={{ margin: '-18px -18px 12px', padding: '18px' }}>
              <h2>Nội dung cần xử lý</h2>
              <span className={`tech-badge tech-badge-${ticket.priority.toLowerCase()}`}>{ticket.priority}</span>
            </header>
            <div className="tech-progress-grid">
              <div className="tech-progress-item"><span className="tech-progress-check"><CheckOutlined /></span><div>Người gửi<strong><small>{ticket.requester.fullName}</small></strong></div></div>
              <div className="tech-progress-item"><span className="tech-progress-check"><CheckOutlined /></span><div>Người phụ trách<strong><small>{ticket.assignee?.fullName ?? 'Chưa phân công'}</small></strong></div></div>
              <div className="tech-progress-item"><span className="tech-progress-check"><CheckOutlined /></span><div>Danh mục<strong><small>{ticket.category.name}</small></strong></div></div>
              <div className="tech-progress-item"><span className="tech-progress-check"><CheckOutlined /></span><div>Trạng thái<strong><small>{statusMeta.label}</small></strong></div></div>
            </div>
          </section>

          <section className="tech-card" style={{ marginBottom: 16, padding: 18 }}>
            <h2 style={{ margin: '0 0 10px', fontSize: 16 }}>Báo cáo từ người gửi</h2>
            <p style={{ margin: 0, color: '#64748b', lineHeight: 1.7 }}>{ticket.description}</p>
            {ticket.requester.email && <p style={{ margin: '12px 0 0', color: '#94a3b8', fontSize: 12 }}>Email: {ticket.requester.email}</p>}
            {ticket.resolutionNote && (
              <Alert
                className="tech-resolution-alert"
                type="success"
                showIcon
                message="Giải pháp đã ghi nhận"
                description={ticket.resolutionNote}
                style={{ marginTop: 14 }}
              />
            )}
          </section>

          {ticket.asset && <section className="tech-card" style={{ marginBottom: 16, padding: 18 }}>
            <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>Tài sản liên quan</h2>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Tài sản">{ticket.asset.assetTag} · {ticket.asset.name}</Descriptions.Item>
              <Descriptions.Item label="Danh mục">{ticket.asset.category.name}</Descriptions.Item>
              <Descriptions.Item label="Vị trí">{ticket.asset.location || '—'}</Descriptions.Item>
              <Descriptions.Item label="Trạng thái">{ticket.asset.status.replaceAll('_', ' ')}</Descriptions.Item>
            </Descriptions>
          </section>}

          {canWork && (
            <section className="tech-card" style={{ padding: 18 }}>
              <header className="tech-card-header" style={{ margin: '-18px -18px 16px', padding: '18px' }}>
                <h2>Trao đổi và ghi chú</h2>
                <span style={{ color: '#94a3b8', fontSize: 12 }}>Public / Internal</span>
              </header>
              <h3 style={{ margin: '0 0 6px', fontSize: 14 }}>Trao đổi công khai</h3>
              <div className="tech-public-alert">Gửi thông tin, cập nhật hoặc câu hỏi công khai cho người yêu cầu.</div>
              <Input.TextArea aria-label="Phản hồi công khai" value={publicReply} onChange={(event) => setPublicReply(event.target.value)} rows={4} maxLength={2000} showCount placeholder="Nội dung phản hồi" />
              <Button type="primary" className="tech-primary-button" loading={busy} disabled={!publicReply.trim()} style={{ marginTop: 12, width: 'auto' }} onClick={() => void runAction(() => addTechnicianComment(ticket.id, publicReply.trim(), ticket.version), () => setPublicReply(''))}>Gửi phản hồi công khai</Button>

              <div style={{ height: 1, background: '#edf1f7', margin: '20px 0' }} />
              <h3 style={{ margin: '0 0 6px', fontSize: 14 }}>Ghi chú nội bộ</h3>
              <Input.TextArea aria-label="Ghi chú nội bộ" value={internalNote} onChange={(event) => setInternalNote(event.target.value)} rows={3} maxLength={2000} showCount placeholder="Chỉ nhân viên IT có thể xem" />
              <Button loading={busy} disabled={!internalNote.trim()} style={{ marginTop: 12 }} onClick={() => void runAction(() => addTechnicianNote(ticket.id, internalNote.trim(), ticket.version), () => setInternalNote(''))}>Lưu ghi chú nội bộ</Button>
            </section>
          )}
        </div>

        <aside>
          <section className="tech-card tech-action-card">
            <h3>Thao tác nghiệp vụ</h3>
            {ticket.status === 'ASSIGNED' && (
              <>
                <div className="tech-public-alert">Ticket đã được phân công. Hãy bắt đầu xử lý để chuyển sang trạng thái đang xử lý.</div>
                <button className="tech-primary-button" type="button" disabled={busy} onClick={() => void runAction(() => startAssignedTicket(ticket.id, ticket.version))}>Bắt đầu xử lý</button>
              </>
            )}
            {ticket.status === 'WAITING_REQUESTER' && (
              <div className="tech-public-alert">Ticket đang chờ phản hồi từ người gửi. Khi người gửi phản hồi, hệ thống sẽ tự chuyển Ticket về đang xử lý.</div>
            )}
            {canWork && (
              <>
                <h3 style={{ marginTop: 18 }}>Yêu cầu bổ sung thông tin</h3>
                <Input.TextArea aria-label="Nội dung yêu cầu bổ sung" value={informationRequest} onChange={(event) => setInformationRequest(event.target.value)} rows={3} maxLength={2000} showCount placeholder="Thông tin cần người gửi bổ sung" />
                <button className="tech-secondary-button" type="button" disabled={busy || !informationRequest.trim()} onClick={() => void runAction(() => requestTicketInformation(ticket.id, informationRequest.trim(), ticket.version), () => setInformationRequest(''))}>Yêu cầu bổ sung</button>

                <h3 style={{ marginTop: 18 }}>Kết quả khắc phục</h3>
                <Input.TextArea aria-label="Nội dung giải pháp" value={resolution} onChange={(event) => setResolution(event.target.value)} rows={4} maxLength={2000} showCount placeholder="Mô tả giải pháp đã thực hiện" />
                <button className="tech-primary-button" type="button" disabled={busy || !resolution.trim()} onClick={() => void runAction(() => resolveAssignedTicket(ticket.id, resolution.trim(), ticket.version), () => setResolution(''))}>Đánh dấu đã giải quyết</button>
              </>
            )}
            {ticket.status === 'RESOLVED' && <Alert type="success" showIcon message="Ticket đã chuyển sang RESOLVED" />}
          </section>

          <section className="tech-card tech-history-card">
            <header className="tech-card-header" style={{ margin: '-18px -18px 12px', padding: '18px' }}>
              <h3>Tiến độ xử lý</h3>
            </header>
            {activity.length === 0
              ? <Typography.Text type="secondary">Chưa có hoạt động.</Typography.Text>
              : <Timeline items={timelineItems} />}
          </section>
        </aside>
      </div>
    </main>
  );
}
