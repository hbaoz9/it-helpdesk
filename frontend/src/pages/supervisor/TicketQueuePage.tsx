import { useEffect, useState } from 'react';
import { Alert, Spin } from 'antd';
import { getTickets } from '../../api/tickets';
import type { TicketRecord } from '../../api/types';
import TicketTable from '../../components/tickets/TicketTable';
import { toTicketRow } from '../../components/tickets/ticketAdapter';
import '../../styles/InternalWorkspace.css';

const TicketQueuePage = () => {
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

  const queueTickets = tickets
    .filter((ticket) => ticket.status === 'NEW' || ticket.status === 'TRIAGED')
    .map(toTicketRow);

  return (
    <div className="iw-card">
      <div className="iw-card-header">
        <div>
          <h2 className="iw-card-title">
            Hàng đợi phân loại
          </h2>
          <p className="iw-card-subtitle">
            Ticket ở trạng thái NEW hoặc TRIAGED đang chờ xử lý
          </p>
        </div>
      </div>

      {error && <Alert type="error" showIcon message="Không tải được Ticket" description={error} />}
      {loading ? (
        <Spin />
      ) : (
        <TicketTable
          tickets={queueTickets}
          emptyText="Không có Ticket trong hàng đợi"
        />
      )}
    </div>
  );
};

export default TicketQueuePage;
