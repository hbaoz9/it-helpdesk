import { useEffect, useState } from 'react';
import { Alert, Spin } from 'antd';
import { getTickets } from '../../api/tickets';
import type { TicketRecord } from '../../api/types';
import TicketTable from '../../components/tickets/TicketTable';
import { toTicketRow } from '../../components/tickets/ticketAdapter';
import '../../styles/InternalWorkspace.css';

const AssignmentManagementPage = () => {
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

  const unassignedTickets = tickets
    .filter((ticket) => !ticket.assignee)
    .map(toTicketRow);
  const assignedTickets = tickets
    .filter((ticket) => ticket.assignee)
    .map(toTicketRow);

  return (
    <div className="iw-stack">
      {error && <Alert type="error" showIcon message="Không tải được Ticket" description={error} />}
      {loading ? (
        <Spin />
      ) : (
        <>
      <div className="iw-card">
        <div className="iw-card-header">
          <div>
            <h2 className="iw-card-title">
              Ticket chưa phân công
            </h2>
            <p className="iw-card-subtitle">
              Thao tác phân công thật sẽ được triển khai ở các Tuần sau
            </p>
          </div>
        </div>

        <TicketTable
          tickets={unassignedTickets}
          emptyText="Không có Ticket chưa phân công"
        />
      </div>

      <div className="iw-card">
        <div className="iw-card-header">
          <div>
            <h2 className="iw-card-title">Ticket đã phân công</h2>
            <p className="iw-card-subtitle">
              Theo dõi Ticket đã giao cho Technician
            </p>
          </div>
        </div>

        <TicketTable
          tickets={assignedTickets}
          emptyText="Không có Ticket đã phân công"
        />
      </div>
        </>
      )}
    </div>
  );
};

export default AssignmentManagementPage;
