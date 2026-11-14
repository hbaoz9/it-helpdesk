import { Col, Row } from 'antd';
import { useNavigate } from 'react-router-dom';
import TicketTable from '../../components/tickets/TicketTable';
import { UNASSIGNED_ASSIGNEE } from '../../components/tickets/ticketMetadata';
import { INTERNAL_PATHS } from '../../layouts/internalPaths';
import { MOCK_TICKETS } from '../../data/mockTickets';
import '../../styles/InternalWorkspace.css';

const ASSIGNED_TICKETS = MOCK_TICKETS.filter(
  (ticket) => ticket.assignee !== UNASSIGNED_ASSIGNEE,
);

const STATS = [
  {
    label: 'Ticket được phân công',
    value: ASSIGNED_TICKETS.length,
    tone: '',
  },
  {
    label: 'Đang xử lý',
    value: ASSIGNED_TICKETS.filter((ticket) => ticket.status === 'IN_PROGRESS')
      .length,
    tone: 'is-cyan',
  },
  {
    label: 'Chờ phản hồi từ người yêu cầu',
    value: ASSIGNED_TICKETS.filter(
      (ticket) => ticket.status === 'WAITING_REQUESTER',
    ).length,
    tone: 'is-amber',
  },
  {
    label: 'Đã giải quyết',
    value: ASSIGNED_TICKETS.filter((ticket) => ticket.status === 'RESOLVED')
      .length,
    tone: 'is-green',
  },
];

export default function TechnicianHomePage() {
  const navigate = useNavigate();

  return (
    <div className="iw-stack">
      <Row gutter={[16, 16]}>
        {STATS.map((stat) => (
          <Col key={stat.label} xs={24} sm={12} lg={6}>
            <div className="iw-card iw-stat">
              <div className="iw-stat-label">{stat.label}</div>
              <div className={`iw-stat-value ${stat.tone}`}>
                {stat.value} Ticket
              </div>
            </div>
          </Col>
        ))}
      </Row>

      <div className="iw-card">
        <div className="iw-card-header">
          <div>
            <h2 className="iw-card-title">
              Ticket được phân công{' '}
              <span>(Dữ liệu minh họa – chưa kết nối Backend)</span>
            </h2>
            <p className="iw-card-subtitle">
              Nhấp Xem chi tiết để mở trang chi tiết Ticket
            </p>
          </div>

          <button
            type="button"
            className="iw-btn-secondary"
            onClick={() => navigate(INTERNAL_PATHS.technicianTickets)}
          >
            Xem tất cả Ticket
          </button>
        </div>

        <TicketTable
          tickets={ASSIGNED_TICKETS}
          onViewDetail={(ticket) =>
            navigate(INTERNAL_PATHS.technicianTicketDetail(ticket.id))
          }
        />
      </div>
    </div>
  );
}
