import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Spin } from 'antd';
import {
  CheckOutlined,
  ClockCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getTechnicianSummary, getTickets } from '../../shared/api/tickets';
import type { TechnicianTicketSummary, TicketRecord } from '../../shared/api/types';
import { useAuth } from '../../shared/auth/useAuth';
import { INTERNAL_PATHS } from '../../layouts/internalPaths';
import './TechnicianWorkspace.css';

function priorityClass(priority: TicketRecord['priority']) {
  return `tech-badge tech-badge-${priority.toLowerCase()}`;
}

function statusClass(status: TicketRecord['status']) {
  if (status === 'IN_PROGRESS') return 'tech-badge tech-badge-progress';
  if (status === 'WAITING_REQUESTER') return 'tech-badge tech-badge-waiting';
  if (status === 'RESOLVED') return 'tech-badge tech-badge-resolved';
  return 'tech-badge tech-badge-assigned';
}

function statusLabel(status: TicketRecord['status']) {
  const labels: Record<TicketRecord['status'], string> = {
    NEW: 'Mới tạo',
    TRIAGED: 'Đã phân loại',
    ASSIGNED: 'Chờ tiếp nhận',
    IN_PROGRESS: 'Đang xử lý',
    WAITING_REQUESTER: 'Chờ người gửi',
    RESOLVED: 'Đã giải quyết',
    CLOSED: 'Đã đóng',
    REJECTED: 'Từ chối',
  };
  return labels[status];
}

export default function TechnicianHomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tickets, setTickets] = useState<TicketRecord[]>([]);
  const [summary, setSummary] = useState<TechnicianTicketSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([getTickets({ scope: 'assigned' }), getTechnicianSummary()])
      .then(([result, counts]) => {
        if (active) {
          setTickets(result);
          setSummary(counts);
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Không tải được Ticket');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const openTickets = useMemo(
    () => tickets.filter((ticket) => !['RESOLVED', 'CLOSED', 'REJECTED'].includes(ticket.status)).slice(0, 5),
    [tickets],
  );

  const stats = [
    {
      label: 'Đang xử lý',
      value: summary?.inProgress ?? 0,
      caption: 'Việc cần tiếp tục',
      icon: <ClockCircleOutlined />,
      tone: 'is-progress',
      onClick: () => navigate(`${INTERNAL_PATHS.technicianTickets}?status=IN_PROGRESS`),
    },
    {
      label: 'Ưu tiên cao',
      value: summary?.highPriority ?? 0,
      caption: 'Cần chú ý trước',
      icon: <WarningOutlined />,
      tone: 'is-high',
      onClick: () => navigate(`${INTERNAL_PATHS.technicianTickets}?priority=P1`),
    },
    {
      label: 'Gần quá hạn',
      value: summary?.waitingRequester ?? 0,
      caption: 'Sắp vượt SLA',
      icon: <ClockCircleOutlined />,
      tone: 'is-waiting',
      onClick: () => navigate(`${INTERNAL_PATHS.technicianTickets}?status=WAITING_REQUESTER`),
    },
    {
      label: 'Đã giải quyết',
      value: summary?.resolved ?? 0,
      caption: 'Trong 7 ngày',
      icon: <CheckOutlined />,
      tone: '',
      onClick: () => navigate(`${INTERNAL_PATHS.technicianTickets}?status=RESOLVED`),
    },
  ];

  const reminders = [
    ...(summary?.requesterReplies
      ? [{
          key: 'requester-replies',
          title: 'Requester đã gửi phản hồi',
          detail: `${summary.requesterReplies} Ticket đã tiếp tục xử lý sau phản hồi bổ sung.`,
          action: 'Xem Ticket đang xử lý',
          onClick: () => navigate(`${INTERNAL_PATHS.technicianTickets}?status=IN_PROGRESS`),
        }]
      : []),
    ...(summary?.waitingRequester
      ? [{
          key: 'waiting-requester',
          title: 'Đang chờ thông tin từ Requester',
          detail: `${summary.waitingRequester} Ticket cần theo dõi phản hồi từ người gửi.`,
          action: 'Xem Ticket chờ phản hồi',
          onClick: () => navigate(`${INTERNAL_PATHS.technicianTickets}?status=WAITING_REQUESTER`),
        }]
      : []),
    ...(summary?.highPriority
      ? [{
          key: 'high-priority',
          title: 'Ticket ưu tiên cao cần xử lý',
          detail: `${summary.highPriority} Ticket P1 chưa được giải quyết hoặc đóng.`,
          action: 'Xem Ticket ưu tiên',
          onClick: () => navigate(`${INTERNAL_PATHS.technicianTickets}?priority=P1`),
        }]
      : []),
    ...(summary?.inProgress
      ? [{
          key: 'resolution',
          title: 'Nhớ ghi giải pháp trước khi giải quyết',
          detail: `${summary.inProgress} Ticket đang xử lý cần ghi kết quả trước khi chuyển sang RESOLVED.`,
          action: 'Xem Ticket đang xử lý',
          onClick: () => navigate(`${INTERNAL_PATHS.technicianTickets}?status=IN_PROGRESS`),
        }]
      : []),
  ];

  if (loading) return <div className="tech-page"><Spin size="large" /></div>;

  return (
    <main className="tech-page">
      {error && <Alert type="error" showIcon message="Không tải được dữ liệu" description={error} />}
      <div className="tech-page-heading">
        <div>
          <span className="tech-eyebrow">TECHNICIAN / WORKSPACE</span>
          <h1>Xin chào, {user?.fullName ?? 'Kỹ thuật viên'} 👋</h1>
          <p>Các yêu cầu IT đang được phân công cho bạn.</p>
        </div>
        <Button className="tech-primary-button" onClick={() => navigate(INTERNAL_PATHS.technicianTickets)}>
          Mở danh sách công việc →
        </Button>
      </div>

      <section className="tech-stat-grid" aria-label="Thống kê công việc">
        {stats.map((stat) => (
          <button
            type="button"
            className={`tech-stat-card ${stat.value > 0 ? stat.tone : ''}`}
            key={stat.label}
            onClick={stat.onClick}
            aria-label={`Xem danh sách: ${stat.label}`}
          >
            <div className="tech-stat-top">
              <span>{stat.label}</span>
              <span className="tech-stat-icon">{stat.icon}</span>
            </div>
            <div className="tech-stat-value">{String(stat.value).padStart(2, '0')}</div>
            <span className="tech-stat-caption">{stat.caption}</span>
          </button>
        ))}
      </section>

      <div className="tech-home-grid">
        <section className="tech-card">
          <header className="tech-card-header">
            <h2>Công việc ưu tiên</h2>
            <button className="tech-text-link" type="button" onClick={() => navigate(INTERNAL_PATHS.technicianTickets)}>Tất cả →</button>
          </header>
          <div className="tech-ticket-table-wrap">
            <table className="tech-ticket-table">
              <thead>
                <tr>
                  <th style={{ width: '16%' }}>Mã yêu cầu</th>
                  <th style={{ width: '36%' }}>Nội dung</th>
                  <th style={{ width: '10%' }}>Ưu tiên</th>
                  <th style={{ width: '16%' }}>Trạng thái</th>
                  <th style={{ width: '14%' }}>Người gửi</th>
                  <th style={{ width: '8%' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {openTickets.map((ticket) => (
                  <tr key={ticket.id}>
                    <td><a className="tech-ticket-code" href={INTERNAL_PATHS.technicianTicketDetail(ticket.id)} onClick={(event) => { event.preventDefault(); navigate(INTERNAL_PATHS.technicianTicketDetail(ticket.id)); }}>{ticket.code}</a></td>
                    <td><span className="tech-ticket-title">{ticket.title}</span><span className="tech-ticket-subtitle">{ticket.category.name}</span></td>
                    <td><span className={priorityClass(ticket.priority)}>{ticket.priority}</span></td>
                    <td><span className={statusClass(ticket.status)}>{statusLabel(ticket.status)}</span></td>
                    <td>{ticket.requester.fullName}</td>
                    <td><button className="tech-text-link" type="button" onClick={() => navigate(INTERNAL_PATHS.technicianTicketDetail(ticket.id))}>Xem chi tiết</button></td>
                  </tr>
                ))}
                {openTickets.length === 0 && (
                  <tr><td colSpan={6} style={{ height: 120, textAlign: 'center', color: '#94a3b8' }}>Hiện chưa có công việc đang mở.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside>
          <section className="tech-card">
            <header className="tech-card-header">
              <h3>Cần chú ý hôm nay</h3>
              {reminders.length > 0 && (
                <span className="tech-badge tech-badge-waiting">{reminders.length} mục</span>
              )}
            </header>
            {reminders.length > 0 ? (
              <div className="tech-checklist">
                {reminders.map((reminder, index) => (
                  <div className="tech-checklist-item" key={reminder.key}>
                    <span className="tech-checklist-number" aria-label={`Mục ${index + 1}`}>{index + 1}</span>
                    <div>
                      <strong>{reminder.title}</strong>
                      <span>{reminder.detail}</span>
                      <button className="tech-reminder-card-action" type="button" onClick={reminder.onClick}>
                        {reminder.action} →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="tech-checklist-empty">
                <CheckOutlined />
                <strong>Không có mục nào cần chú ý</strong>
                <span>Tất cả công việc đang có tiến độ bình thường.</span>
              </div>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}
