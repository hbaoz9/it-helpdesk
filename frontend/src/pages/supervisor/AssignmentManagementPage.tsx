import TicketTable from '../../components/tickets/TicketTable';
import { UNASSIGNED_ASSIGNEE } from '../../components/tickets/ticketMetadata';
import { MOCK_TICKETS } from '../../data/mockTickets';
import '../../styles/InternalWorkspace.css';

const unassignedTickets = MOCK_TICKETS.filter(
  (ticket) => ticket.assignee === UNASSIGNED_ASSIGNEE,
);

const assignedTickets = MOCK_TICKETS.filter(
  (ticket) => ticket.assignee !== UNASSIGNED_ASSIGNEE,
);

const AssignmentManagementPage = () => {
  return (
    <div className="iw-stack">
      <div className="iw-card">
        <div className="iw-card-header">
          <div>
            <h2 className="iw-card-title">
              Ticket chưa phân công{' '}
              <span>(Dữ liệu minh họa – chưa kết nối Backend)</span>
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
    </div>
  );
};

export default AssignmentManagementPage;
