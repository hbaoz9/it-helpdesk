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
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  getSupervisorTechnicians,
  getTickets,
} from '../../shared/api/tickets';
import type {
  SupervisorTechnicianSummary,
  TicketRecord,
} from '../../shared/api/types';
import TicketPriorityTag from '../../shared/components/tickets/TicketPriorityTag';
import TicketStatusTag from '../../shared/components/tickets/TicketStatusTag';
import SupervisorWorkbenchDrawer from './SupervisorWorkbenchDrawer';
import '../../styles/InternalWorkspace.css';

const AssignmentManagementPage = () => {
  const [tickets, setTickets] = useState<TicketRecord[]>([]);
  const [technicians, setTechnicians] = useState<
    SupervisorTechnicianSummary[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  const loadAssignments = useCallback(() => {
    setLoading(true);
    Promise.all([getTickets(), getSupervisorTechnicians()])
      .then(([ticketList, techList]) => {
        setTickets(ticketList);
        setTechnicians(techList);
        setError(null);
      })
      .catch((cause: unknown) => {
        setError(
          cause instanceof Error
            ? cause.message
            : 'Không tải được dữ liệu phân công',
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
              : 'Không tải được dữ liệu phân công',
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

  const unassignedTickets = tickets.filter(
    (ticket) =>
      !ticket.assignee &&
      (ticket.status === 'NEW' || ticket.status === 'TRIAGED'),
  );
  const assignedTickets = tickets.filter((ticket) => Boolean(ticket.assignee));

  const buildColumns = (isAssignedTable: boolean): ColumnsType<TicketRecord> => [
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
      width: 210,
      render: (status: TicketRecord['status']) => (
        <TicketStatusTag status={status} />
      ),
    },
    {
      title: 'Kỹ thuật viên hiện tại',
      key: 'assignee',
      width: 170,
      render: (_, record) =>
        record.assignee ? (
          <strong>{record.assignee.fullName}</strong>
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
      width: 185,
      render: (_, record) => (
        <Button
          type={isAssignedTable ? 'default' : 'primary'}
          size="small"
          onClick={() => setSelectedTicketId(record.id)}
        >
          {record.status === 'NEW'
            ? 'Phân loại trước (BR-01)'
            : isAssignedTable
              ? 'Phân công lại (Reassign)'
              : 'Phân công Technician'}
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
          message="Không tải được Ticket"
          description={error}
          action={
            <Button size="small" onClick={loadAssignments}>
              Thử lại
            </Button>
          }
        />
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin size="large" />
        </div>
      ) : !error ? (
        <>
          {/* Thẻ tải công việc hiện tại của các Technician */}
          {technicians.length > 0 && (
            <Row gutter={[16, 16]}>
              {technicians.map((tech) => (
                <Col key={tech.id} xs={24} sm={12} lg={8}>
                  <div className="iw-card" style={{ padding: 18 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <strong>{tech.fullName}</strong>
                        <div className="iw-muted" style={{ fontSize: 12 }}>
                          {tech.email}
                        </div>
                      </div>
                      <Tag
                        color={
                          tech.activeAssignedCount > 3
                            ? 'volcano'
                            : tech.activeAssignedCount > 0
                              ? 'blue'
                              : 'green'
                        }
                      >
                        Đang giữ: {tech.activeAssignedCount} Ticket
                      </Tag>
                    </div>
                    <Space
                      wrap
                      size={8}
                      style={{ marginTop: 10, fontSize: 12 }}
                    >
                      <span>Đã giao: {tech.assignedCount}</span>
                      <span>·</span>
                      <span>Đang xử lý: {tech.inProgressCount}</span>
                      <span>·</span>
                      <span>Chờ phản hồi: {tech.waitingRequesterCount}</span>
                    </Space>
                  </div>
                </Col>
              ))}
            </Row>
          )}

          <div className="iw-card">
            <div className="iw-card-header">
              <div>
                <h2 className="iw-card-title">
                  Ticket chưa phân công ({unassignedTickets.length})
                </h2>
                <p className="iw-card-subtitle">
                  Các yêu cầu đang chờ người phụ trách (Ticket ở trạng thái NEW
                  cần được Triage sang TRIAGED trước khi Assign theo BR-01).
                </p>
              </div>
              <Button onClick={loadAssignments}>Làm mới</Button>
            </div>

            <Table<TicketRecord>
              rowKey="id"
              columns={buildColumns(false)}
              dataSource={unassignedTickets}
              pagination={{ pageSize: 5, showSizeChanger: false }}
              scroll={{ x: 960 }}
              locale={{
                emptyText: (
                  <Empty description="Không có Ticket chưa phân công" />
                ),
              }}
            />
          </div>

          <div className="iw-card">
            <div className="iw-card-header">
              <div>
                <h2 className="iw-card-title">
                  Ticket đã phân công &amp; Điều chuyển ({assignedTickets.length})
                </h2>
                <p className="iw-card-subtitle">
                  Theo dõi Ticket đã giao cho Technician; chọn Phân công lại
                  (Reassign) để đổi người xử lý và lưu lịch sử Audit.
                </p>
              </div>
            </div>

            <Table<TicketRecord>
              rowKey="id"
              columns={buildColumns(true)}
              dataSource={assignedTickets}
              pagination={{ pageSize: 6, showSizeChanger: false }}
              scroll={{ x: 960 }}
              locale={{
                emptyText: (
                  <Empty description="Không có Ticket đã phân công" />
                ),
              }}
            />
          </div>
        </>
      ) : null}

      <SupervisorWorkbenchDrawer
        ticketId={selectedTicketId}
        technicians={technicians}
        onClose={() => setSelectedTicketId(null)}
        onUpdated={loadAssignments}
      />
    </div>
  );
};

export default AssignmentManagementPage;
