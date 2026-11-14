import { useMemo, useState } from 'react';
import { Col, Row, Select } from 'antd';
import { useNavigate } from 'react-router-dom';
import type { TicketStatus } from '../../types/ticket';
import TicketTable from '../../components/tickets/TicketTable';
import {
  STATUS_METADATA,
  UNASSIGNED_ASSIGNEE,
} from '../../components/tickets/ticketMetadata';
import { INTERNAL_PATHS } from '../../layouts/internalPaths';
import { MOCK_TICKETS } from '../../data/mockTickets';
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
const ASSIGNED_TICKETS = MOCK_TICKETS.filter(
  (ticket) => ticket.assignee !== UNASSIGNED_ASSIGNEE,
);

export default function AssignedTicketsPage() {
  const navigate = useNavigate();
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | TicketStatus>(
    'ALL',
  );

  const filteredTickets = useMemo(() => {
    if (selectedStatus === 'ALL') {
      return ASSIGNED_TICKETS;
    }

    return ASSIGNED_TICKETS.filter((ticket) => ticket.status === selectedStatus);
  }, [selectedStatus]);

  return (
    <div className="iw-card">
      <div className="iw-card-header">
        <div>
          <h2 className="iw-card-title">
            Danh sách Ticket được phân công{' '}
            <span>(Dữ liệu minh họa – chưa kết nối Backend)</span>
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

      <TicketTable
        tickets={filteredTickets}
        onViewDetail={(ticket) =>
          navigate(INTERNAL_PATHS.technicianTicketDetail(ticket.id))
        }
      />
    </div>
  );
}
