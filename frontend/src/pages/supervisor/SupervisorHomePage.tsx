import { useEffect, useState } from 'react';
import { Alert, Col, Row, Spin } from 'antd';
import { getTickets } from '../../api/tickets';
import type { TicketRecord } from '../../api/types';
import '../../styles/InternalWorkspace.css';

const SupervisorHomePage = () => {
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

  const overviewItems = [
    { label: 'Ticket mới', value: tickets.filter((ticket) => ticket.status === 'NEW').length, tone: '' },
    { label: 'Đã phân loại', value: tickets.filter((ticket) => ticket.status === 'TRIAGED').length, tone: 'is-cyan' },
    { label: 'Chưa phân công', value: tickets.filter((ticket) => !ticket.assignee).length, tone: 'is-amber' },
    { label: 'Đang xử lý', value: tickets.filter((ticket) => ticket.status === 'IN_PROGRESS').length, tone: 'is-green' },
  ];

  return (
    <div className="iw-stack">
      {error && <Alert type="error" showIcon message="Không tải được Ticket" description={error} />}
      {loading ? (
        <Spin />
      ) : (
        <Row gutter={[16, 16]}>
          {overviewItems.map((item) => (
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
      )}
    </div>
  );
};

export default SupervisorHomePage;
