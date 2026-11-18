import { useEffect, useMemo, useState } from 'react';
import { Alert, Col, Row, Select, Spin } from 'antd';
import { useNavigate } from 'react-router-dom';
import type { TicketStatus } from '../../shared/types/ticket';
import { getTickets } from '../../shared/api/tickets';
import type { TicketRecord } from '../../shared/api/types';
import TicketTable from '../../shared/components/tickets/TicketTable';
import { toTicketRow } from '../../shared/components/tickets/ticketAdapter';
import { STATUS_METADATA } from '../../shared/components/tickets/ticketMetadata';
import { INTERNAL_PATHS } from '../../layouts/internalPaths';
import '../../styles/InternalWorkspace.css';

const STATUS_FILTER_OPTIONS: { value: 'ALL' | TicketStatus; label: string }[] =
  [
    { value: 'ALL', label: 'Tất cả trạng thái' },
    ...(Object.keys(STATUS_METADATA) as TicketStatus[]).map((status) => ({
      value: status,
      label: STATUS_METADATA[status].label.replace(' · ', ' – '),
    })),
  ];

export default function AssignedTicketsPage() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<TicketRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | TicketStatus>(
    'ALL',
  );

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

  const filteredTickets = useMemo(() => {
    return tickets
      .filter(
        (ticket) =>
          ticket.assignee &&
          (selectedStatus === 'ALL' || ticket.status === selectedStatus),
      )
      .map(toTicketRow);
  }, [tickets, selectedStatus]);

  return (
    <div className="iw-card">
      <div className="iw-card-header">
        <div>
          <h2 className="iw-card-title">
            Danh sách Ticket được phân công
          </h2>
          <p className="iw-card-subtitle">
            Chọn trạng thái để tìm công việc cần xử lý.
          </p>
        </div>
      </div>

      <Row gutter={[12, 12]} style={{ marginBottom: 18 }}>
        <Col xs={24} sm={12} md={8}>
          <Select
            aria-label="Lọc theo trạng thái"
            style={{ width: '100%' }}
            value={selectedStatus}
            options={STATUS_FILTER_OPTIONS}
            onChange={(value) => setSelectedStatus(value)}
          />
        </Col>
      </Row>

      {error && <Alert type="error" showIcon message="Không tải được Ticket" description={error} />}
      {loading ? (
        <Spin />
      ) : !error ? (
        <TicketTable
          tickets={filteredTickets}
          emptyText="Không có Ticket phù hợp với bộ lọc."
          onViewDetail={(ticket) =>
            navigate(INTERNAL_PATHS.technicianTicketDetail(ticket.id))
          }
        />
      ) : null}
    </div>
  );
}
