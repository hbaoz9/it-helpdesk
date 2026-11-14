import { useEffect, useMemo, useState } from 'react';
import { Alert, Col, Row, Select, Spin } from 'antd';
import { useNavigate } from 'react-router-dom';
import type { TicketStatus } from '../../types/ticket';
import { getTickets } from '../../api/tickets';
import type { TicketRecord } from '../../api/types';
import TicketTable from '../../components/tickets/TicketTable';
import { toTicketRow } from '../../components/tickets/ticketAdapter';
import { STATUS_METADATA } from '../../components/tickets/ticketMetadata';
import { INTERNAL_PATHS } from '../../layouts/internalPaths';
import '../../styles/InternalWorkspace.css';

// Nhãn lọc giống Requester Portal: "NEW – Mới tạo".
const STATUS_FILTER_OPTIONS: { value: 'ALL' | TicketStatus; label: string }[] =
  [
    { value: 'ALL', label: 'Tất cả trạng thái' },
    ...(Object.keys(STATUS_METADATA) as TicketStatus[]).map((status) => ({
      value: status,
      label: STATUS_METADATA[status].label.replace(' · ', ' – '),
    })),
  ];

// Đặt ngoài component để không bị tính lại mỗi lần render.
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
            Lọc theo trạng thái chuẩn trong API Contract
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
      ) : (
        <TicketTable
          tickets={filteredTickets}
          onViewDetail={(ticket) =>
            navigate(INTERNAL_PATHS.technicianTicketDetail(ticket.id))
          }
        />
      )}
    </div>
  );
}
