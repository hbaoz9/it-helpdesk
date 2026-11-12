import { Col, Row } from 'antd';
import { UNASSIGNED_ASSIGNEE } from '../../components/tickets/ticketMetadata';
import { MOCK_TICKETS } from '../../data/mockTickets';
import '../../styles/InternalWorkspace.css';

const OVERVIEW_ITEMS = [
  {
    label: 'Ticket mới',
    value: MOCK_TICKETS.filter((ticket) => ticket.status === 'NEW').length,
    tone: '',
  },
  {
    label: 'Đã phân loại',
    value: MOCK_TICKETS.filter((ticket) => ticket.status === 'TRIAGED').length,
    tone: 'is-cyan',
  },
  {
    label: 'Chưa phân công',
    value: MOCK_TICKETS.filter(
      (ticket) => ticket.assignee === UNASSIGNED_ASSIGNEE,
    ).length,
    tone: 'is-amber',
  },
  {
    label: 'Đang xử lý',
    value: MOCK_TICKETS.filter((ticket) => ticket.status === 'IN_PROGRESS')
      .length,
    tone: 'is-green',
  },
];

const SupervisorHomePage = () => {
  return (
    <div className="iw-stack">
      <Row gutter={[16, 16]}>
        {OVERVIEW_ITEMS.map((item) => (
          <Col key={item.label} xs={24} sm={12} lg={6}>
            <div className="iw-card iw-stat">
              <div className="iw-stat-label">{item.label}</div>
              <div className={`iw-stat-value ${item.tone}`}>
                {item.value} Ticket
              </div>
            </div>
          </Col>
        ))}
      </Row>
    </div>
  );
};

export default SupervisorHomePage;
