import TicketTable from '../../components/tickets/TicketTable';
import { MOCK_TICKETS } from '../../data/mockTickets';
import '../../styles/InternalWorkspace.css';

const queueTickets = MOCK_TICKETS.filter(
  (ticket) => ticket.status === 'NEW' || ticket.status === 'TRIAGED',
);

const TicketQueuePage = () => {
  return (
    <div className="iw-card">
      <div className="iw-card-header">
        <div>
          <h2 className="iw-card-title">
            Hàng đợi phân loại{' '}
            <span>(Dữ liệu minh họa – chưa kết nối Backend)</span>
          </h2>
          <p className="iw-card-subtitle">
            Ticket ở trạng thái NEW hoặc TRIAGED đang chờ xử lý
          </p>
        </div>
      </div>

      <TicketTable
        tickets={queueTickets}
        emptyText="Không có Ticket trong hàng đợi"
      />
    </div>
  );
};

export default TicketQueuePage;
