import { useEffect, useMemo, useState } from 'react';
import { Alert, Input, Select, Spin } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getTickets } from '../../shared/api/tickets';
import type { TicketRecord } from '../../shared/api/types';
import type { TicketPriority, TicketStatus } from '../../shared/types/ticket';
import { INTERNAL_PATHS } from '../../layouts/internalPaths';
import './TechnicianWorkspace.css';

const statuses: { value: 'ALL' | TicketStatus; label: string }[] = [
  { value: 'ALL', label: 'Tất cả trạng thái' },
  { value: 'ASSIGNED', label: 'Chờ tiếp nhận' },
  { value: 'IN_PROGRESS', label: 'Đang xử lý' },
  { value: 'WAITING_REQUESTER', label: 'Chờ người gửi' },
  { value: 'RESOLVED', label: 'Đã giải quyết' },
  { value: 'CLOSED', label: 'Đã đóng' },
];

const priorities: { value: 'ALL' | TicketPriority; label: string }[] = [
  { value: 'ALL', label: 'Tất cả mức ưu tiên' },
  { value: 'P1', label: 'P1 – Critical' },
  { value: 'P2', label: 'P2 – High' },
  { value: 'P3', label: 'P3 – Medium' },
  { value: 'P4', label: 'P4 – Low' },
];

function statusLabel(status: TicketStatus) {
  return statuses.find((item) => item.value === status)?.label ?? status;
}

function statusClass(status: TicketStatus) {
  if (status === 'IN_PROGRESS') return 'tech-badge tech-badge-progress';
  if (status === 'WAITING_REQUESTER') return 'tech-badge tech-badge-waiting';
  if (status === 'RESOLVED') return 'tech-badge tech-badge-resolved';
  if (status === 'CLOSED') return 'tech-badge tech-badge-neutral';
  return 'tech-badge tech-badge-assigned';
}

export default function AssignedTicketsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [tickets, setTickets] = useState<TicketRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initialStatus = searchParams.get('status');
  const [status, setStatus] = useState<'ALL' | TicketStatus>(
    statuses.some((item) => item.value === initialStatus)
      ? (initialStatus as TicketStatus)
      : 'ALL',
  );
  const initialPriority = searchParams.get('priority');
  const [priority, setPriority] = useState<'ALL' | TicketPriority>(
    priorities.some((item) => item.value === initialPriority)
      ? (initialPriority as TicketPriority)
      : 'ALL',
  );
  const [search, setSearch] = useState('');

  useEffect(() => {
    let active = true;
    getTickets({ scope: 'assigned' })
      .then((result) => { if (active) setTickets(result); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Không tải được Ticket'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return tickets.filter((ticket) =>
      (status === 'ALL' || ticket.status === status) &&
      (priority === 'ALL' || ticket.priority === priority) &&
      (!term || ticket.code.toLowerCase().includes(term) ||
        ticket.title.toLowerCase().includes(term) ||
        ticket.requester.fullName.toLowerCase().includes(term)),
    );
  }, [tickets, status, priority, search]);

  return (
    <main className="tech-page">
      <div className="tech-page-heading">
        <div>
          <span className="tech-eyebrow">KỸ THUẬT VIÊN</span>
          <h1>Công việc được giao</h1>
          <p>Chỉ hiển thị các Ticket thuộc trách nhiệm xử lý của bạn.</p>
        </div>
        <button className="tech-primary-button" type="button" onClick={() => navigate(INTERNAL_PATHS.technician)}>Quay về trang chủ</button>
      </div>

      <div className="tech-filter-card">
        <div className="tech-filter-row">
          <Input aria-label="Tìm Ticket" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm mã, nội dung, người gửi..." />
          <Select aria-label="Lọc theo mức ưu tiên" value={priority} onChange={setPriority} options={priorities} />
          <Select aria-label="Lọc theo trạng thái" value={status} onChange={setStatus} options={statuses} />
        </div>
      </div>

      {error && <Alert type="error" showIcon message="Không tải được công việc" description={error} />}
      {loading ? <div className="tech-card" style={{ padding: 32, textAlign: 'center' }}><Spin /></div> : (
        <section className="tech-card">
          <div className="tech-ticket-table-wrap">
            <table className="tech-ticket-table">
              <thead>
                <tr>
                  <th style={{ width: '14%' }}>Mã yêu cầu</th>
                  <th style={{ width: '34%' }}>Nội dung</th>
                  <th style={{ width: '10%' }}>Ưu tiên</th>
                  <th style={{ width: '16%' }}>Trạng thái</th>
                  <th style={{ width: '16%' }}>Người gửi</th>
                  <th style={{ width: '10%' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((ticket) => (
                  <tr key={ticket.id}>
                    <td><a className="tech-ticket-code" href={INTERNAL_PATHS.technicianTicketDetail(ticket.id)} onClick={(event) => { event.preventDefault(); navigate(INTERNAL_PATHS.technicianTicketDetail(ticket.id)); }}>{ticket.code}</a></td>
                    <td><span className="tech-ticket-title">{ticket.title}</span><span className="tech-ticket-subtitle">{ticket.category.name} · {new Date(ticket.createdAt).toLocaleString('vi-VN')}</span></td>
                    <td><span className={`tech-badge tech-badge-${ticket.priority.toLowerCase()}`}>{ticket.priority}</span></td>
                    <td><span className={statusClass(ticket.status)}>{statusLabel(ticket.status)}</span></td>
                    <td>{ticket.requester.fullName}</td>
                    <td><button className="tech-text-link" type="button" onClick={() => navigate(INTERNAL_PATHS.technicianTicketDetail(ticket.id))}>Xem chi tiết →</button></td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} style={{ height: 160, textAlign: 'center', color: '#94a3b8' }}>Không có công việc phù hợp với bộ lọc.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
