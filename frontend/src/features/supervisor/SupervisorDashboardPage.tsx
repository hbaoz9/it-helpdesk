import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Col,
  Descriptions,
  Empty,
  Input,
  Row,
  Select,
  Spin,
  Table,
  Tag,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  getSupervisorDashboard,
  getTickets,
} from '../../shared/api/tickets';
import type {
  SupervisorDashboardSummary,
  SupervisorTechnicianSummary,
  TicketPriority,
  TicketRecord,
  TicketStatus,
} from '../../shared/api/types';
import TicketPriorityTag from '../../shared/components/tickets/TicketPriorityTag';
import TicketStatusTag from '../../shared/components/tickets/TicketStatusTag';
import { STATUS_METADATA } from '../../shared/components/tickets/ticketMetadata';
import SupervisorWorkbenchDrawer from './SupervisorWorkbenchDrawer';
import '../../styles/InternalWorkspace.css';

const STATUS_FILTER_OPTIONS: { value: 'ALL' | TicketStatus; label: string }[] = [
  { value: 'ALL', label: 'Tất cả trạng thái' },
  ...(
    Object.entries(STATUS_METADATA) as [
      TicketStatus,
      { label: string; color: string },
    ][]
  ).map(([value, meta]) => ({
    value,
    label: meta.label,
  })),
];

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

const SupervisorDashboardPage = () => {
  const [dashboard, setDashboard] =
    useState<SupervisorDashboardSummary | null>(null);
  const [tickets, setTickets] = useState<TicketRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | TicketStatus>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | TicketPriority>(
    'ALL',
  );
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  const loadDashboard = useCallback(() => {
    setLoading(true);
    Promise.all([getSupervisorDashboard(), getTickets()])
      .then(([dashResult, ticketResult]) => {
        setDashboard(dashResult);
        setTickets(ticketResult);
        setError(null);
      })
      .catch((cause: unknown) => {
        setError(
          cause instanceof Error
            ? cause.message
            : 'Không tải được dữ liệu Dashboard',
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([getSupervisorDashboard(), getTickets()])
      .then(([dashResult, ticketResult]) => {
        if (!active) return;
        setDashboard(dashResult);
        setTickets(ticketResult);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : 'Không tải được dữ liệu Dashboard',
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

  const filteredTickets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return tickets.filter((ticket) => {
      if (statusFilter !== 'ALL' && ticket.status !== statusFilter) {
        return false;
      }
      if (priorityFilter !== 'ALL' && ticket.priority !== priorityFilter) {
        return false;
      }
      if (
        q &&
        !ticket.code.toLowerCase().includes(q) &&
        !ticket.title.toLowerCase().includes(q) &&
        !ticket.category.name.toLowerCase().includes(q) &&
        !ticket.requester.fullName.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [tickets, statusFilter, priorityFilter, searchQuery]);

  const workloadColumns: ColumnsType<SupervisorTechnicianSummary> = [
    {
      title: 'Kỹ thuật viên',
      dataIndex: 'fullName',
      key: 'fullName',
      render: (name: string, tech) => (
        <div>
          <strong>{name}</strong>
          <div className="iw-muted" style={{ fontSize: 12 }}>
            {tech.email}
          </div>
        </div>
      ),
    },
    {
      title: 'Tổng đang mở',
      dataIndex: 'activeAssignedCount',
      key: 'activeAssignedCount',
      render: (count: number) => (
        <Tag color={count > 3 ? 'volcano' : count > 0 ? 'blue' : 'default'}>
          {count} Ticket
        </Tag>
      ),
    },
    {
      title: 'ASSIGNED',
      dataIndex: 'assignedCount',
      key: 'assignedCount',
    },
    {
      title: 'IN_PROGRESS',
      dataIndex: 'inProgressCount',
      key: 'inProgressCount',
    },
    {
      title: 'WAITING_REQUESTER',
      dataIndex: 'waitingRequesterCount',
      key: 'waitingRequesterCount',
    },
    {
      title: 'RESOLVED',
      dataIndex: 'resolvedCount',
      key: 'resolvedCount',
    },
    {
      title: 'CLOSED',
      dataIndex: 'closedCount',
      key: 'closedCount',
    },
  ];

  const ticketColumns: ColumnsType<TicketRecord> = [
    {
      title: 'Mã Ticket',
      dataIndex: 'code',
      key: 'code',
      width: 150,
      render: (code: string) => <span className="iw-ticket-code">{code}</span>,
    },
    {
      title: 'Tiêu đề sự cố',
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
      title: 'Ưu tiên',
      dataIndex: 'priority',
      key: 'priority',
      width: 135,
      render: (priority: TicketRecord['priority']) => (
        <TicketPriorityTag priority={priority} />
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 215,
      render: (status: TicketRecord['status']) => (
        <TicketStatusTag status={status} />
      ),
    },
    {
      title: 'Kỹ thuật viên',
      key: 'assignee',
      width: 165,
      render: (_, record) =>
        record.assignee ? (
          record.assignee.fullName
        ) : (
          <span className="iw-muted">Chưa phân công</span>
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
      title: 'Thao tác',
      key: 'action',
      width: 145,
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          onClick={() => setSelectedTicketId(record.id)}
        >
          Chi tiết / Điều phối
        </Button>
      ),
    },
  ];

  return (
    <div className="iw-stack">
      {error && (
        <Alert
          type="error"
          showIcon
          message="Không tải được Dashboard"
          description={error}
          action={
            <Button size="small" onClick={loadDashboard}>
              Thử lại
            </Button>
          }
        />
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin size="large" />
        </div>
      ) : !error && dashboard ? (
        <>
          {/* Hàng KPI chính từ dữ liệu thật */}
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} lg={6}>
              <div className="iw-card iw-stat">
                <div className="iw-stat-label">Tổng số Ticket hệ thống</div>
                <div className="iw-stat-value">
                  {dashboard.totalTickets} Ticket
                </div>
              </div>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <div className="iw-card iw-stat">
                <div className="iw-stat-label">Hàng đợi Triage (NEW + TRIAGED)</div>
                <div className="iw-stat-value is-cyan">
                  {dashboard.triageQueueCount} Ticket
                </div>
              </div>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <div className="iw-card iw-stat">
                <div className="iw-stat-label">Ticket chưa phân công</div>
                <div className="iw-stat-value is-amber">
                  {dashboard.unassignedCount} Ticket
                </div>
              </div>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <div className="iw-card iw-stat">
                <div className="iw-stat-label">
                  Cảnh báo / Vi phạm SLA
                </div>
                <div className="iw-stat-value" style={{ color: '#dc2626' }}>
                  {dashboard.sla.atRisk + dashboard.sla.breached} Ticket
                </div>
              </div>
            </Col>
          </Row>

          {/* Phân bố theo Trạng thái, Priority & SLA */}
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={14}>
              <div className="iw-card" style={{ height: '100%' }}>
                <div className="iw-card-header">
                  <div>
                    <h2 className="iw-card-title">
                      Thống kê theo Trạng thái Ticket
                    </h2>
                    <p className="iw-card-subtitle">
                      Số liệu thời gian thực tính từ cơ sở dữ liệu PostgreSQL
                    </p>
                  </div>
                </div>
                <Descriptions column={{ xs: 1, sm: 2 }} size="small" bordered>
                  <Descriptions.Item label="NEW (Mới tạo)">
                    <strong>{dashboard.byStatus.NEW}</strong>
                  </Descriptions.Item>
                  <Descriptions.Item label="TRIAGED (Đã phân loại)">
                    <strong>{dashboard.byStatus.TRIAGED}</strong>
                  </Descriptions.Item>
                  <Descriptions.Item label="ASSIGNED (Đã phân công)">
                    <strong>{dashboard.byStatus.ASSIGNED}</strong>
                  </Descriptions.Item>
                  <Descriptions.Item label="IN_PROGRESS (Đang xử lý)">
                    <strong>{dashboard.byStatus.IN_PROGRESS}</strong>
                  </Descriptions.Item>
                  <Descriptions.Item label="WAITING_REQUESTER (Chờ phản hồi)">
                    <strong>{dashboard.byStatus.WAITING_REQUESTER}</strong>
                  </Descriptions.Item>
                  <Descriptions.Item label="RESOLVED (Đã giải quyết)">
                    <strong>{dashboard.byStatus.RESOLVED}</strong>
                  </Descriptions.Item>
                  <Descriptions.Item label="CLOSED (Đã đóng)">
                    <strong>{dashboard.byStatus.CLOSED}</strong>
                  </Descriptions.Item>
                  <Descriptions.Item label="REJECTED (Từ chối)">
                    <strong>{dashboard.byStatus.REJECTED}</strong>
                  </Descriptions.Item>
                </Descriptions>
              </div>
            </Col>

            <Col xs={24} lg={10}>
              <div className="iw-card" style={{ height: '100%' }}>
                <div className="iw-card-header">
                  <div>
                    <h2 className="iw-card-title">
                      Thống kê theo Priority &amp; SLA
                    </h2>
                    <p className="iw-card-subtitle">
                      Phân bổ mức ưu tiên P1–P4 và sức khỏe SLA 24/7
                    </p>
                  </div>
                </div>
                <Descriptions column={1} size="small" bordered>
                  <Descriptions.Item label="P1 – Critical (15p / 4h)">
                    <Tag color="red">{dashboard.byPriority.P1} Ticket</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="P2 – High (1h / 8h)">
                    <Tag color="volcano">{dashboard.byPriority.P2} Ticket</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="P3 – Medium (4h / 24h)">
                    <Tag color="gold">{dashboard.byPriority.P3} Ticket</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="P4 – Low (8h / 72h)">
                    <Tag color="green">{dashboard.byPriority.P4} Ticket</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Tình trạng SLA">
                    <Tag color="processing">
                      Trong hạn: {dashboard.sla.onTrack}
                    </Tag>
                    <Tag color="warning">
                      Sắp quá hạn: {dashboard.sla.atRisk}
                    </Tag>
                    <Tag color="error">Quá hạn: {dashboard.sla.breached}</Tag>
                    <Tag color="success">Đạt: {dashboard.sla.met}</Tag>
                    {dashboard.sla.unknown > 0 && <Tag>Chưa có SLA: {dashboard.sla.unknown}</Tag>}
                  </Descriptions.Item>
                </Descriptions>
              </div>
            </Col>
          </Row>

          {/* Khối lượng công việc theo Kỹ thuật viên */}
          <div className="iw-card">
            <div className="iw-card-header">
              <div>
                <h2 className="iw-card-title">
                  Khối lượng công việc theo Kỹ thuật viên (Technician Workload)
                </h2>
                <p className="iw-card-subtitle">
                  Tự động cập nhật khi Supervisor phân công hoặc phân công lại
                  Ticket
                </p>
              </div>
            </div>
            <Table<SupervisorTechnicianSummary>
              rowKey="id"
              columns={workloadColumns}
              dataSource={dashboard.workloadByTechnician}
              pagination={false}
              scroll={{ x: 760 }}
              locale={{
                emptyText: (
                  <Empty description="Chưa có Kỹ thuật viên nào trong hệ thống" />
                ),
              }}
            />
          </div>

          {/* Danh sách toàn bộ Ticket trong hệ thống */}
          <div className="iw-card">
            <div className="iw-card-header">
              <div>
                <h2 className="iw-card-title">
                  Danh sách tất cả Ticket ({filteredTickets.length})
                </h2>
                <p className="iw-card-subtitle">
                  Tra cứu, lọc và mở ngăn điều phối chi tiết cho bất kỳ Ticket
                  nào trong hệ thống
                </p>
              </div>
              <Button onClick={loadDashboard}>Làm mới</Button>
            </div>

            <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
              <Col xs={24} md={10}>
                <Input.Search
                  allowClear
                  placeholder="Tìm theo mã Ticket, tiêu đề, danh mục hoặc người gửi..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </Col>
              <Col xs={24} sm={12} md={7}>
                <Select
                  style={{ width: '100%' }}
                  value={statusFilter}
                  options={STATUS_FILTER_OPTIONS}
                  onChange={setStatusFilter}
                />
              </Col>
              <Col xs={24} sm={12} md={7}>
                <Select
                  style={{ width: '100%' }}
                  value={priorityFilter}
                  options={PRIORITY_FILTER_OPTIONS}
                  onChange={setPriorityFilter}
                />
              </Col>
            </Row>

            <Table<TicketRecord>
              rowKey="id"
              columns={ticketColumns}
              dataSource={filteredTickets}
              pagination={{ pageSize: 8, showSizeChanger: false }}
              scroll={{ x: 960 }}
              locale={{
                emptyText: <Empty description="Chưa có Ticket nào." />,
              }}
            />
          </div>
        </>
      ) : null}

      <SupervisorWorkbenchDrawer
        ticketId={selectedTicketId}
        technicians={dashboard?.workloadByTechnician ?? []}
        onClose={() => setSelectedTicketId(null)}
        onUpdated={loadDashboard}
      />
    </div>
  );
};

export default SupervisorDashboardPage;
