import { useEffect, useState } from 'react';
import { Alert, Col, Row, Spin } from 'antd';
import { useNavigate } from 'react-router-dom';
import { getTickets } from '../../api/tickets';
import type { TicketRecord } from '../../api/types';
import TicketTable from '../../components/tickets/TicketTable';
import { toTicketRow } from '../../components/tickets/ticketAdapter';
import { INTERNAL_PATHS } from '../../layouts/internalPaths';
import '../../styles/InternalWorkspace.css';

export default function TechnicianHomePage() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<TicketRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getTickets()
      .then((result) => {
        if (active) setTickets(result);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Không tải được Ticket');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const stats = [
    { label: 'Ticket được phân công', value: tickets.length, tone: '' },
    {
      label: 'Đang xử lý',
      value: tickets.filter((ticket) => ticket.status === 'IN_PROGRESS').length,
      tone: 'is-cyan',
    },
    {
      label: 'Chờ phản hồi từ người yêu cầu',
      value: tickets.filter((ticket) => ticket.status === 'WAITING_REQUESTER').length,
      tone: 'is-amber',
    },
    {
      label: 'Đã giải quyết',
      value: tickets.filter((ticket) => ticket.status === 'RESOLVED').length,
      tone: 'is-green',
    },
  ];

  return (
    <div className="iw-stack">
      {error && <Alert type="error" showIcon message="Không tải được Ticket" description={error} />}
      {loading ? (
        <Spin />
      ) : (
        <>
          <Row gutter={[16, 16]}>
            {stats.map((stat) => (
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
                <h2 className="iw-card-title">Ticket được phân công</h2>
                <p className="iw-card-subtitle">
                  Danh sách Ticket đang gán cho tài khoản kỹ thuật viên này.
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
              tickets={tickets.map(toTicketRow)}
              onViewDetail={(ticket) =>
                navigate(INTERNAL_PATHS.technicianTicketDetail(ticket.id))
              }
            />
          </div>
        </>
      )}
    </div>
  );
}
