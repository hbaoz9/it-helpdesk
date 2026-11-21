import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Col,
  Empty,
  Row,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import {
  getSupervisorDashboard,
  getTickets,
} from '../../shared/api/tickets';
import type {
  SupervisorDashboardSummary,
  SupervisorTechnicianSummary,
  TicketRecord,
} from '../../shared/api/types';
import TicketPriorityTag from '../../shared/components/tickets/TicketPriorityTag';
import TicketStatusTag from '../../shared/components/tickets/TicketStatusTag';
import SupervisorWorkbenchDrawer from './SupervisorWorkbenchDrawer';
import '../../styles/InternalWorkspace.css';

const SupervisorHomePage = () => {
  const navigate = useNavigate();
  const [dashboard, setDashboard] =
    useState<SupervisorDashboardSummary | null>(null);
  const [tickets, setTickets] = useState<TicketRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  const loadData = useCallback(() => {
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
            : 'Không tải được dữ liệu điều phối',
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
              : 'Không tải được dữ liệu điều phối',
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

  const overviewItems = [
    {
      label: 'Ticket mới (Chờ Triage)',
      value: dashboard?.byStatus.NEW ?? 0,
      tone: '',
    },
    {
      label: 'Đã phân loại (Chờ Assign)',
      value: dashboard?.byStatus.TRIAGED ?? 0,
      tone: 'is-cyan',
    },
    {
      label: 'Chưa phân công',
      value: dashboard?.unassignedCount ?? 0,
      tone: 'is-amber',
    },
    {
      label: 'Đang xử lý',
      value:
        (dashboard?.byStatus.ASSIGNED ?? 0) +
        (dashboard?.byStatus.IN_PROGRESS ?? 0),
      tone: 'is-green',
    },
  ];

  const queueTickets = tickets.filter(
    (t) => t.status === 'NEW' || t.status === 'TRIAGED',
  );

  const queueColumns: ColumnsType<TicketRecord> = [
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
      title: 'Thao tác điều phối',
      key: 'action',
      width: 180,
      render: (_, record) => (
        <Button
          type="primary"
          size="small"
          onClick={() => setSelectedTicketId(record.id)}
        >
          {record.status === 'NEW'
            ? 'Phân loại (Triage)'
            : 'Phân công Technician'}
        </Button>
      ),
    },
  ];

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
      title: 'Đang phụ trách',
      dataIndex: 'activeAssignedCount',
      key: 'activeAssignedCount',
      render: (count: number) => (
        <Tag color={count > 3 ? 'volcano' : count > 0 ? 'blue' : 'default'}>
          {count} Ticket
        </Tag>
      ),
    },
    {
      title: 'Đã giao (ASSIGNED)',
      dataIndex: 'assignedCount',
      key: 'assignedCount',
    },
    {
      title: 'Đang xử lý (IN_PROGRESS)',
      dataIndex: 'inProgressCount',
      key: 'inProgressCount',
    },
    {
      title: 'Chờ phản hồi',
      dataIndex: 'waitingRequesterCount',
      key: 'waitingRequesterCount',
    },
    {
      title: 'Đã giải quyết / Đóng',
      key: 'completed',
      render: (_, tech) => `${tech.resolvedCount + tech.closedCount} Ticket`,
    },
  ];

  return (
    <div className="iw-stack">
      {error && (
        <Alert
          type="error"
          showIcon
          message="Không tải được dữ liệu điều phối"
          description={error}
          action={
            <Button size="small" onClick={loadData}>
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

          {/* Cảnh báo nhanh SLA */}
          <div className="iw-card">
            <div className="iw-card-header">
              <div>
                <h2 className="iw-card-title">Tình trạng SLA toàn hệ thống</h2>
                <p className="iw-card-subtitle">
                  Giám sát thời hạn phản hồi đầu tiên và thời hạn giải quyết
                  theo chính sách SLA 24/7
                </p>
              </div>
              <Space wrap>
                <Button onClick={() => navigate('/supervisor/queue')}>
                  Mở Hàng đợi Triage
                </Button>
                <Button onClick={() => navigate('/supervisor/assignments')}>
                  Quản lý Phân công
                </Button>
                <Button
                  type="primary"
                  onClick={() => navigate('/supervisor/dashboard')}
                >
                  Xem Dashboard chi tiết
                </Button>
              </Space>
            </div>

            <Row gutter={[16, 16]}>
              <Col xs={12} sm={6}>
                <Tag color="processing" style={{ fontSize: 13, padding: '6px 12px' }}>
                  Trong hạn SLA: <strong>{dashboard.sla.onTrack}</strong>
                </Tag>
              </Col>
              <Col xs={12} sm={6}>
                <Tag color="warning" style={{ fontSize: 13, padding: '6px 12px' }}>
                  Sắp quá hạn (≥80%): <strong>{dashboard.sla.atRisk}</strong>
                </Tag>
              </Col>
              <Col xs={12} sm={6}>
                <Tag color="error" style={{ fontSize: 13, padding: '6px 12px' }}>
                  Quá hạn SLA: <strong>{dashboard.sla.breached}</strong>
                </Tag>
              </Col>
              <Col xs={12} sm={6}>
                <Tag color="success" style={{ fontSize: 13, padding: '6px 12px' }}>
                  Đã đạt SLA: <strong>{dashboard.sla.met}</strong>
                </Tag>
              </Col>
            </Row>
            {(dashboard.sla.excluded > 0 || dashboard.sla.unknown > 0) && (
              <Typography.Text type="secondary">
                Không tính SLA (từ chối): {dashboard.sla.excluded} · Chưa có SLA: {dashboard.sla.unknown}
              </Typography.Text>
            )}
          </div>

          {/* Hàng đợi cần điều phối ngay */}
          <div className="iw-card">
            <div className="iw-card-header">
              <div>
                <h2 className="iw-card-title">
                  Hàng đợi cần điều phối ({queueTickets.length} Ticket)
                </h2>
                <p className="iw-card-subtitle">
                  Phân loại Ticket mới (NEW → TRIAGED) và phân công Kỹ thuật
                  viên (TRIAGED → ASSIGNED)
                </p>
              </div>
              <Button onClick={loadData}>Làm mới dữ liệu</Button>
            </div>

            <Table<TicketRecord>
              rowKey="id"
              columns={queueColumns}
              dataSource={queueTickets}
              pagination={{ pageSize: 5, showSizeChanger: false }}
              scroll={{ x: 860 }}
              locale={{
                emptyText: (
                  <Empty description="Không có Ticket nào đang chờ phân loại hoặc phân công" />
                ),
              }}
            />
          </div>

          {/* Khối lượng công việc theo Technician */}
          <div className="iw-card">
            <div className="iw-card-header">
              <div>
                <h2 className="iw-card-title">
                  Khối lượng công việc theo Kỹ thuật viên
                </h2>
                <p className="iw-card-subtitle">
                  Số lượng Ticket thực tế đang giao cho từng Technician
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
                  <Empty description="Chưa có tài khoản Kỹ thuật viên đang hoạt động" />
                ),
              }}
            />
          </div>
        </>
      ) : null}

      <SupervisorWorkbenchDrawer
        ticketId={selectedTicketId}
        technicians={dashboard?.workloadByTechnician ?? []}
        onClose={() => setSelectedTicketId(null)}
        onUpdated={loadData}
      />
    </div>
  );
};

export default SupervisorHomePage;
