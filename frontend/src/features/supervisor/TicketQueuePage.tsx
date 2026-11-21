import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Col,
  Empty,
  Input,
  Row,
  Select,
  Space,
  Spin,
  Table,
  Tag,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  getSupervisorTechnicians,
  getTickets,
} from '../../shared/api/tickets';
import type {
  SupervisorTechnicianSummary,
  TicketPriority,
  TicketRecord,
} from '../../shared/api/types';
import TicketPriorityTag from '../../shared/components/tickets/TicketPriorityTag';
import TicketStatusTag from '../../shared/components/tickets/TicketStatusTag';
import SupervisorWorkbenchDrawer from './SupervisorWorkbenchDrawer';
import '../../styles/InternalWorkspace.css';

type QueueFilter = 'ALL_QUEUE' | 'NEW' | 'TRIAGED';

const PRIORITY_FILTER_OPTIONS: {
  value: 'ALL' | TicketPriority;
  label: string;
}[] = [
  { value: 'ALL', label: 'Tất cả mức ưu tiên' },
  { value: 'P1', label: 'P1 – Critical' },
  { value: 'P2', label: 'P2 – High' },
  { value: 'P3', label: 'P3 – Medium' },
  { value: 'P4', label: 'P4 – Low' },
];

const TicketQueuePage = () => {
  const [tickets, setTickets] = useState<TicketRecord[]>([]);
  const [technicians, setTechnicians] = useState<
    SupervisorTechnicianSummary[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [queueFilter, setQueueFilter] = useState<QueueFilter>('ALL_QUEUE');
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | TicketPriority>(
    'ALL',
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  const loadQueue = useCallback(() => {
    setLoading(true);
    Promise.all([getTickets(), getSupervisorTechnicians()])
      .then(([ticketList, techList]) => {
        setTickets(ticketList);
        setTechnicians(techList);
        setError(null);
      })
      .catch((cause: unknown) => {
        setError(
          cause instanceof Error ? cause.message : 'Không tải được hàng đợi Ticket',
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([getTickets(), getSupervisorTechnicians()])
      .then(([ticketList, techList]) => {
        if (!active) return;
        setTickets(ticketList);
        setTechnicians(techList);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : 'Không tải được hàng đợi Ticket',
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const queueTickets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return tickets.filter((ticket) => {
      const inQueue =
        queueFilter === 'ALL_QUEUE'
          ? ticket.status === 'NEW' || ticket.status === 'TRIAGED'
          : ticket.status === queueFilter;
      if (!inQueue) return false;
      if (priorityFilter !== 'ALL' && ticket.priority !== priorityFilter) {
        return false;
      }
      if (
        q &&
        !ticket.code.toLowerCase().includes(q) &&
        !ticket.title.toLowerCase().includes(q) &&
        !ticket.requester.fullName.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [tickets, queueFilter, priorityFilter, searchQuery]);

  const newCount = tickets.filter((t) => t.status === 'NEW').length;
  const triagedCount = tickets.filter((t) => t.status === 'TRIAGED').length;

  const columns: ColumnsType<TicketRecord> = [
    {
      title: 'Mã Ticket',
      dataIndex: 'code',
      key: 'code',
      width: 150,
      render: (code: string) => <span className="iw-ticket-code">{code}</span>,
    },
    {
      title: 'Tiêu đề & Danh mục',
      dataIndex: 'title',
      key: 'title',
      render: (title: string, record) => (
        <div>
          <div className="iw-ticket-title">{title}</div>
          <span className="iw-muted" style={{ fontSize: 12 }}>
            {record.category.name} · Người gửi: {record.requester.fullName}
          </span>
        </div>
      ),
    },
    {
      title: 'Impact × Urgency',
      key: 'matrix',
      width: 150,
      render: (_, record) => (
        <span>
          <Tag>{record.impact}</Tag> × <Tag>{record.urgency}</Tag>
        </span>
      ),
    },
    {
      title: 'Ưu tiên',
      dataIndex: 'priority',
      key: 'priority',
      width: 140,
      render: (priority: TicketRecord['priority']) => (
        <TicketPriorityTag priority={priority} />
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 210,
      render: (status: TicketRecord['status']) => (
        <TicketStatusTag status={status} />
      ),
    },
    {
      title: 'Thời điểm tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 165,
      render: (val: string) => new Date(val).toLocaleString('vi-VN'),
    },
    {
      title: 'Điều phối',
      key: 'action',
      width: 210,
      render: (_, record) => (
        <Space>
          <Button
            type="primary"
            size="small"
            onClick={() => setSelectedTicketId(record.id)}
          >
            {record.status === 'NEW'
              ? 'Phân loại (Triage)'
              : 'Phân công (Assign)'}
          </Button>
          <Button
            size="small"
            onClick={() => setSelectedTicketId(record.id)}
          >
            Chi tiết
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="iw-stack">
      <div className="iw-card">
        <div className="iw-card-header">
          <div>
            <h2 className="iw-card-title">
              Hàng đợi Ticket mới &amp; Phân loại (Triage Queue)
            </h2>
            <p className="iw-card-subtitle">
              Tiếp nhận Ticket ở trạng thái NEW để phân loại sang TRIAGED, từ
              chối Ticket không hợp lệ hoặc phân công Kỹ thuật viên (ASSIGNED)
            </p>
          </div>
          <Button onClick={loadQueue}>Làm mới</Button>
        </div>

        <Space wrap style={{ marginBottom: 16 }}>
          <Button
            type={queueFilter === 'ALL_QUEUE' ? 'primary' : 'default'}
            onClick={() => setQueueFilter('ALL_QUEUE')}
          >
            Tất cả hàng đợi ({newCount + triagedCount})
          </Button>
          <Button
            type={queueFilter === 'NEW' ? 'primary' : 'default'}
            onClick={() => setQueueFilter('NEW')}
          >
            NEW – Chờ phân loại ({newCount})
          </Button>
          <Button
            type={queueFilter === 'TRIAGED' ? 'primary' : 'default'}
            onClick={() => setQueueFilter('TRIAGED')}
          >
            TRIAGED – Chờ phân công ({triagedCount})
          </Button>
        </Space>

        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col xs={24} md={14}>
            <Input.Search
              allowClear
              placeholder="Tìm theo mã Ticket, tiêu đề hoặc tên người gửi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </Col>
          <Col xs={24} md={10}>
            <Select
              style={{ width: '100%' }}
              value={priorityFilter}
              options={PRIORITY_FILTER_OPTIONS}
              onChange={setPriorityFilter}
            />
          </Col>
        </Row>

        {error && (
          <Alert
            type="error"
            showIcon
            message="Không tải được Ticket"
            description={error}
            style={{ marginBottom: 16 }}
          />
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 36 }}>
            <Spin />
          </div>
        ) : !error ? (
          <Table<TicketRecord>
            rowKey="id"
            columns={columns}
            dataSource={queueTickets}
            pagination={{ pageSize: 8, showSizeChanger: false }}
            scroll={{ x: 960 }}
            locale={{
              emptyText: (
                <Empty description="Không có Ticket nào trong hàng đợi" />
              ),
            }}
          />
        ) : null}
      </div>

      <SupervisorWorkbenchDrawer
        ticketId={selectedTicketId}
        technicians={technicians}
        onClose={() => setSelectedTicketId(null)}
        onUpdated={loadQueue}
      />
    </div>
  );
};

export default TicketQueuePage;
