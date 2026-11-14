import { useEffect, useState } from 'react';
import { Alert, Spin } from 'antd';
import { getTickets } from '../../api/tickets';
import type { TicketRecord } from '../../api/types';
import TicketTable from '../../components/tickets/TicketTable';
import { toTicketRow } from '../../components/tickets/ticketAdapter';
import '../../styles/InternalWorkspace.css';

const SupervisorDashboardPage = () => {
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

  return (
    <div className="iw-stack">
      <div className="iw-card">
        <div className="iw-card-header">
          <div>
            <h2 className="iw-card-title">Tổng quan Ticket</h2>
            <p className="iw-card-subtitle">
              Ticket được tải trực tiếp từ Backend.
            </p>
          </div>
        </div>
        {error && <Alert type="error" showIcon message="Không tải được Ticket" description={error} />}
        {loading ? <Spin /> : <TicketTable tickets={tickets.map(toTicketRow)} />}
      </div>
    </div>
  );
};

export default SupervisorDashboardPage;
