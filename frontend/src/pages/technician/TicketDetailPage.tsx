import { useEffect, useState } from 'react';
import { Alert, Descriptions, Spin } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { getTicket } from '../../api/tickets';
import type { TicketRecord } from '../../api/types';
import TicketStatusTag from '../../components/tickets/TicketStatusTag';
import TicketPriorityTag from '../../components/tickets/TicketPriorityTag';
import { INTERNAL_PATHS } from '../../layouts/internalPaths';
import '../../styles/InternalWorkspace.css';

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<TicketRecord | null>(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [error, setError] = useState<string | null>(
    id ? null : 'Mã Ticket không hợp lệ.',
  );

  useEffect(() => {
    if (!id) return;

    let active = true;
    getTicket(id)
      .then((result) => {
        if (active) setTicket(result);
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : 'Không tải được Ticket');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const backButton = (
    <button
      type="button"
      className="iw-btn-secondary"
      onClick={() => navigate(INTERNAL_PATHS.technicianTickets)}
    >
      ← Danh sách Ticket
    </button>
  );

  if (loading) {
    return (
      <div className="iw-card" style={{ textAlign: 'center', padding: 32 }}>
        <Spin />
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="iw-card">
        <div className="iw-card-header">
          <div>
            <h2 className="iw-card-title">Không tải được Ticket</h2>
            <p className="iw-card-subtitle">{error ?? 'Ticket không tồn tại.'}</p>
          </div>
          {backButton}
        </div>
      </div>
    );
  }

  return (
    <div className="iw-stack">
      <div className="iw-card">
        <div className="iw-card-header">
          <div>
            <h2 className="iw-card-title">{ticket.code}</h2>
            <p className="iw-card-subtitle">Thông tin từ Backend</p>
          </div>
          <div className="iw-card-actions">
            <TicketStatusTag status={ticket.status} />
            {backButton}
          </div>
        </div>

        <h3 className="iw-detail-title">{ticket.title}</h3>
        <Descriptions bordered size="small" column={{ xs: 1, sm: 2, lg: 3 }}>
          <Descriptions.Item label="Mã Ticket">
            <strong className="iw-ticket-code">{ticket.code}</strong>
          </Descriptions.Item>
          <Descriptions.Item label="Danh mục">
            {ticket.category.name}
          </Descriptions.Item>
          <Descriptions.Item label="Mức ưu tiên">
            <TicketPriorityTag priority={ticket.priority} />
          </Descriptions.Item>
          <Descriptions.Item label="Trạng thái">
            <TicketStatusTag status={ticket.status} />
          </Descriptions.Item>
          <Descriptions.Item label="Người yêu cầu">
            {ticket.requester.fullName}
          </Descriptions.Item>
          <Descriptions.Item label="Người xử lý">
            {ticket.assignee?.fullName ?? 'Chưa phân công'}
          </Descriptions.Item>
          <Descriptions.Item label="Impact">
            {ticket.impact}
          </Descriptions.Item>
          <Descriptions.Item label="Urgency">
            {ticket.urgency}
          </Descriptions.Item>
          <Descriptions.Item label="Thời điểm tạo">
            {new Date(ticket.createdAt).toLocaleString('vi-VN')}
          </Descriptions.Item>
        </Descriptions>
      </div>

      <div className="iw-card">
        <div className="iw-card-header">
          <div>
            <h2 className="iw-card-title">Mô tả sự cố</h2>
          </div>
        </div>
        <p className="iw-comment-text">{ticket.description}</p>
        {ticket.resolutionNote && (
          <Alert
            type="success"
            showIcon
            message="Nội dung giải pháp"
            description={ticket.resolutionNote}
          />
        )}
      </div>
    </div>
  );
}
