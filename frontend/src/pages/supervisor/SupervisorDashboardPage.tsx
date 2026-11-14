import TicketTable from '../../components/tickets/TicketTable';
import { MOCK_TICKETS } from '../../data/mockTickets';
import '../../styles/InternalWorkspace.css';

const SupervisorDashboardPage = () => {
  return (
    <div className="iw-stack">
      <div className="iw-card">
        <div className="iw-card-header">
          <div>
            <h2 className="iw-card-title">
              Tổng quan Ticket{' '}
              <span>(Dữ liệu minh họa – chưa kết nối Backend)</span>
            </h2>
            <p className="iw-card-subtitle">
              Danh sách toàn bộ Ticket với mức ưu tiên và trạng thái
            </p>
          </div>
        </div>

        <TicketTable tickets={MOCK_TICKETS} />
      </div>

      <div className="iw-card">
        <div className="iw-card-header">
          <div>
            <h2 className="iw-card-title">Tiến độ xử lý</h2>
            <p className="iw-card-subtitle">
              Khu vực hiển thị tổng quan tiến độ xử lý Ticket
            </p>
          </div>
        </div>

        <p className="iw-note" style={{ margin: 0 }}>
          Số liệu và biểu đồ thực tế chưa được triển khai trong Tuần 3.
        </p>
      </div>
    </div>
  );
};

export default SupervisorDashboardPage;
