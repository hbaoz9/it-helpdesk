import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Empty,
  Input,
  Popconfirm,
  Row,
  Select,
  Space,
  Spin,
  Tag,
  Timeline,
  Typography,
  message,
} from 'antd';
import {
  assignTicket,
  getCategories,
  getSupervisorTicketEvents,
  getTicket,
  getTicketSla,
  overrideTicketPriority,
  rejectTicket,
  triageTicket,
} from '../../shared/api/tickets';
import type {
  Category,
  ImpactLevel,
  SlaHealthStatus,
  SupervisorTechnicianSummary,
  TicketActivity,
  TicketPriority,
  TicketRecord,
  TicketSlaSnapshot,
  UrgencyLevel,
} from '../../shared/api/types';
import { ApiError } from '../../shared/api/client';
import TicketPriorityTag from '../../shared/components/tickets/TicketPriorityTag';
import TicketStatusTag from '../../shared/components/tickets/TicketStatusTag';

const IMPACT_OPTIONS: { value: ImpactLevel; label: string }[] = [
  { value: 'LOW', label: 'LOW – Cá nhân (Thấp)' },
  { value: 'MEDIUM', label: 'MEDIUM – Nhóm / Phòng ban (Trung bình)' },
  { value: 'HIGH', label: 'HIGH – Nhiều phòng ban / Toàn công ty (Cao)' },
];

const URGENCY_OPTIONS: { value: UrgencyLevel; label: string }[] = [
  { value: 'LOW', label: 'LOW – Có thể chờ (Thấp)' },
  { value: 'MEDIUM', label: 'MEDIUM – Cần hỗ trợ sớm (Trung bình)' },
  { value: 'HIGH', label: 'HIGH – Cần hỗ trợ ngay (Khẩn cấp)' },
];

const PRIORITY_OPTIONS: { value: TicketPriority; label: string }[] = [
  { value: 'P1', label: 'P1 – Critical' },
  { value: 'P2', label: 'P2 – High' },
  { value: 'P3', label: 'P3 – Medium' },
  { value: 'P4', label: 'P4 – Low' },
];

const SLA_STATUS_META: Record<
  SlaHealthStatus,
  { label: string; color: string }
> = {
  MET: { label: 'Đạt cam kết SLA', color: 'success' },
  ON_TRACK: { label: 'Trong hạn SLA', color: 'processing' },
  AT_RISK: { label: 'Sắp quá hạn (≥80%)', color: 'warning' },
  BREACHED: { label: 'Quá hạn SLA', color: 'error' },
  EXCLUDED: { label: 'Không tính SLA', color: 'default' },
};

function calculateMatrixPriority(
  impact: ImpactLevel,
  urgency: UrgencyLevel,
): TicketPriority {
  const matrix: Record<ImpactLevel, Record<UrgencyLevel, TicketPriority>> = {
    LOW: { LOW: 'P4', MEDIUM: 'P4', HIGH: 'P3' },
    MEDIUM: { LOW: 'P4', MEDIUM: 'P3', HIGH: 'P2' },
    HIGH: { LOW: 'P3', MEDIUM: 'P2', HIGH: 'P1' },
  };
  return matrix[impact][urgency];
}

interface SupervisorWorkbenchDrawerProps {
  ticketId: string | null;
  technicians: SupervisorTechnicianSummary[];
  onClose: () => void;
  onUpdated: () => void;
}

export default function SupervisorWorkbenchDrawer({
  ticketId,
  technicians,
  onClose,
  onUpdated,
}: SupervisorWorkbenchDrawerProps) {
  const [ticket, setTicket] = useState<TicketRecord | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [events, setEvents] = useState<TicketActivity[]>([]);
  const [sla, setSla] = useState<TicketSlaSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  // Triage form states
  const [triageCategoryId, setTriageCategoryId] = useState<string>('');
  const [triageImpact, setTriageImpact] = useState<ImpactLevel>('MEDIUM');
  const [triageUrgency, setTriageUrgency] = useState<UrgencyLevel>('MEDIUM');
  const [triageReason, setTriageReason] = useState('');

  // Assign / Reassign states
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string>('');
  const [assignReason, setAssignReason] = useState('');

  // Priority Override states
  const [overridePriorityValue, setOverridePriorityValue] =
    useState<TicketPriority>('P3');
  const [overrideReason, setOverrideReason] = useState('');

  // Reject states
  const [rejectReason, setRejectReason] = useState('');

  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    getCategories()
      .then((list) => setCategories(list))
      .catch(() => {
        /* Fallback to ticket's category if categories call fails */
      });
  }, []);

  useEffect(() => {
    if (!ticketId) {
      return;
    }

    let active = true;

    Promise.all([
      getTicket(ticketId),
      getSupervisorTicketEvents(ticketId),
      getTicketSla(ticketId).catch((cause: unknown) => {
        if (cause instanceof ApiError && cause.status === 503 && cause.message.includes('SLA snapshot unavailable')) {
          return null;
        }
        throw cause;
      }),
    ])
      .then(([loadedTicket, loadedEvents, loadedSla]) => {
        if (!active) return;
        setTicket(loadedTicket);
        setEvents(loadedEvents);
        setSla(loadedSla);
        setError(null);
        setTriageCategoryId(loadedTicket.category.id);
        setTriageImpact(loadedTicket.impact);
        setTriageUrgency(loadedTicket.urgency);
        setTriageReason('');
        setSelectedAssigneeId(loadedTicket.assignee?.id ?? '');
        setAssignReason('');
        setOverridePriorityValue(loadedTicket.priority);
        setOverrideReason('');
        setRejectReason('');
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : 'Không thể tải thông tin chi tiết Ticket.',
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [ticketId, refreshTick]);

  const isLoadingTicket =
    Boolean(ticketId) && (loading || (ticket?.id !== ticketId && !error));

  const computedTriagePriority = useMemo(
    () => calculateMatrixPriority(triageImpact, triageUrgency),
    [triageImpact, triageUrgency],
  );

  async function executeSupervisorAction(
    runner: () => Promise<TicketRecord>,
    successMessage: string,
  ) {
    setBusy(true);
    setError(null);
    try {
      await runner();
      messageApi.success(successMessage);
      setRefreshTick((v) => v + 1);
      onUpdated();
    } catch (cause: unknown) {
      const msg =
        cause instanceof Error ? cause.message : 'Thao tác không thành công.';
      setError(msg);
      messageApi.error(msg);
      setRefreshTick((v) => v + 1);
      onUpdated();
    } finally {
      setBusy(false);
    }
  }

  const canTriage = ticket?.status === 'NEW';
  const canAssign =
    ticket !== null &&
    ['TRIAGED', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_REQUESTER'].includes(
      ticket.status,
    );
  const canReject =
    ticket !== null &&
    (ticket.status === 'NEW' || ticket.status === 'TRIAGED');
  const canOverridePriority =
    ticket !== null &&
    ticket.status !== 'CLOSED' &&
    ticket.status !== 'REJECTED';

  return (
    <Drawer
      title={
        ticket
          ? `Điều phối Ticket: ${ticket.code} (v${ticket.version})`
          : 'Chi tiết & Điều phối Ticket'
      }
      width={720}
      open={Boolean(ticketId)}
      onClose={onClose}
    >
      {contextHolder}
      {isLoadingTicket ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin size="large" />
        </div>
      ) : error && !ticket ? (
        <Alert
          type="error"
          showIcon
          message="Không tải được Ticket"
          description={error}
          action={
            <Button
              size="small"
              onClick={() => {
                setLoading(true);
                setRefreshTick((v) => v + 1);
              }}
            >
              Thử lại
            </Button>
          }
        />
      ) : ticket ? (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          {error && (
            <Alert
              type="error"
              showIcon
              closable
              message="Lỗi thao tác"
              description={error}
            />
          )}

          {/* Tóm tắt thông tin Ticket */}
          <Card
            size="small"
            title={ticket.title}
            extra={
              <Space>
                <TicketPriorityTag priority={ticket.priority} />
                <TicketStatusTag status={ticket.status} />
              </Space>
            }
          >
            <Descriptions column={{ xs: 1, sm: 2 }} size="small" bordered>
              <Descriptions.Item label="Mã Ticket">
                <strong>{ticket.code}</strong>
              </Descriptions.Item>
              <Descriptions.Item label="Danh mục">
                {ticket.category.name}
              </Descriptions.Item>
              <Descriptions.Item label="Người gửi (Requester)">
                {ticket.requester.fullName}
              </Descriptions.Item>
              <Descriptions.Item label="Kỹ thuật viên (Assignee)">
                {ticket.assignee?.fullName ?? (
                  <Typography.Text type="secondary">
                    Chưa phân công
                  </Typography.Text>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Impact × Urgency">
                <Tag>{ticket.impact}</Tag> × <Tag>{ticket.urgency}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Thời điểm tạo">
                {new Date(ticket.createdAt).toLocaleString('vi-VN')}
              </Descriptions.Item>
            </Descriptions>

            <Typography.Paragraph
              style={{
                marginTop: 12,
                marginBottom: 0,
                whiteSpace: 'pre-wrap',
              }}
            >
              <strong>Mô tả sự cố:</strong> {ticket.description}
            </Typography.Paragraph>
          </Card>

          {/* Thông tin SLA (Dữ liệu nền cho SLA Worker Tuần 5) */}
          {sla && (
            <Card
              size="small"
              title="Giám sát thời hạn SLA 24/7"
              extra={
                <Tag color={SLA_STATUS_META[sla.overallStatus].color}>
                  {SLA_STATUS_META[sla.overallStatus].label}
                </Tag>
              }
            >
              <Alert
                type="info"
                showIcon
                style={{ marginBottom: 12 }}
                message={`Hạn SLA chốt khi tạo Ticket theo chính sách ${sla.policyPriority ?? 'không xác định'} (revision ${sla.policyRevision}). Priority hiện tại: ${sla.priority}.`}
                description={`Mục tiêu phản hồi ${sla.responseTargetMinutes} phút, giải quyết ${sla.resolutionTargetMinutes} phút. Phân loại hoặc điều chỉnh Priority sau đó không đổi hai deadline bên dưới.`}
              />
              <Descriptions column={{ xs: 1, sm: 2 }} size="small" bordered>
                <Descriptions.Item label="Hạn phản hồi đầu tiên">
                  {new Date(sla.responseDueAt).toLocaleString('vi-VN')}{' '}
                  <Tag color={SLA_STATUS_META[sla.responseStatus].color}>
                    {SLA_STATUS_META[sla.responseStatus].label}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Hạn giải quyết">
                  {new Date(sla.resolutionDueAt).toLocaleString('vi-VN')}{' '}
                  <Tag color={SLA_STATUS_META[sla.resolutionStatus].color}>
                    {SLA_STATUS_META[sla.resolutionStatus].label}
                  </Tag>
                </Descriptions.Item>
              </Descriptions>
            </Card>
          )}
          {!sla && (
            <Alert type="info" showIcon message="Ticket cũ chưa có SLA snapshot; chưa thể xác định deadline lịch sử." />
          )}

          {/* Bước 1: Phân loại Ticket (Triage: NEW -> TRIAGED) */}
          {canTriage && (
            <Card
              size="small"
              title="1. Phân loại Ticket mới (Triage: NEW → TRIAGED)"
            >
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                  Theo quy tắc BR-01, Ticket ở trạng thái <strong>NEW</strong>{' '}
                  phải được kiểm tra danh mục, mức độ ảnh hưởng và khẩn cấp để
                  xác định Priority trước khi phân công kỹ thuật viên.
                </Typography.Text>

                <Row gutter={[12, 12]}>
                  <Col xs={24}>
                    <Typography.Text strong>Danh mục sự cố</Typography.Text>
                    <Select
                      style={{ width: '100%', marginTop: 4 }}
                      value={triageCategoryId}
                      options={categories.map((cat) => ({
                        value: cat.id,
                        label: cat.name,
                      }))}
                      onChange={setTriageCategoryId}
                    />
                  </Col>
                  <Col xs={24} sm={12}>
                    <Typography.Text strong>
                      Mức ảnh hưởng (Impact)
                    </Typography.Text>
                    <Select
                      style={{ width: '100%', marginTop: 4 }}
                      value={triageImpact}
                      options={IMPACT_OPTIONS}
                      onChange={setTriageImpact}
                    />
                  </Col>
                  <Col xs={24} sm={12}>
                    <Typography.Text strong>
                      Tính khẩn cấp (Urgency)
                    </Typography.Text>
                    <Select
                      style={{ width: '100%', marginTop: 4 }}
                      value={triageUrgency}
                      options={URGENCY_OPTIONS}
                      onChange={setTriageUrgency}
                    />
                  </Col>
                </Row>

                <div>
                  <Typography.Text>
                    Mức ưu tiên theo ma trận 3×3:{' '}
                  </Typography.Text>
                  <TicketPriorityTag priority={computedTriagePriority} />
                </div>

                <Input
                  value={triageReason}
                  onChange={(e) => setTriageReason(e.target.value)}
                  placeholder="Ghi chú phân loại (tùy chọn)..."
                  maxLength={500}
                />

                <Button
                  type="primary"
                  loading={busy}
                  onClick={() =>
                    void executeSupervisorAction(
                      () =>
                        triageTicket(ticket.id, {
                          version: ticket.version,
                          categoryId: triageCategoryId || undefined,
                          impact: triageImpact,
                          urgency: triageUrgency,
                          reason: triageReason.trim() || undefined,
                        }),
                      `Đã phân loại Ticket ${ticket.code} sang trạng thái TRIAGED (${computedTriagePriority}).`,
                    )
                  }
                >
                  Xác nhận phân loại (NEW → TRIAGED)
                </Button>
              </Space>
            </Card>
          )}

          {/* Nhắc nhở BR-01 nếu Ticket đang ở trạng thái NEW */}
          {ticket.status === 'NEW' && (
            <Alert
              type="info"
              showIcon
              message="Quy tắc BR-01: Hoàn tất bước Phân loại (Triage) ở trên để mở khóa chức năng Phân công Kỹ thuật viên."
            />
          )}

          {/* Bước 2: Phân công / Phân công lại Kỹ thuật viên */}
          {canAssign && (
            <Card
              size="small"
              title={
                ticket.assignee
                  ? `2. Phân công lại Kỹ thuật viên (Hiện tại: ${ticket.assignee.fullName})`
                  : '2. Phân công Kỹ thuật viên (TRIAGED → ASSIGNED)'
              }
            >
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <div>
                  <Typography.Text strong>
                    Chọn Kỹ thuật viên phụ trách
                  </Typography.Text>
                  <Select
                    style={{ width: '100%', marginTop: 4 }}
                    placeholder="Chọn Kỹ thuật viên..."
                    value={selectedAssigneeId || undefined}
                    onChange={setSelectedAssigneeId}
                    options={technicians.map((tech) => {
                      const isRequester = tech.id === ticket.requester.id;
                      return {
                        value: tech.id,
                        disabled: isRequester,
                        label: `${tech.fullName} (${tech.email}) — Đang xử lý: ${tech.activeAssignedCount} Ticket${
                          isRequester ? ' [Người tạo Ticket]' : ''
                        }`,
                      };
                    })}
                  />
                </div>

                <Input
                  value={assignReason}
                  onChange={(e) => setAssignReason(e.target.value)}
                  placeholder={
                    ticket.assignee
                      ? 'Nhập lý do phân công lại / điều chuyển kỹ thuật viên...'
                      : 'Ghi chú phân công (tùy chọn)...'
                  }
                  maxLength={500}
                />

                <Button
                  type="primary"
                  loading={busy}
                  disabled={!selectedAssigneeId}
                  onClick={() =>
                    void executeSupervisorAction(
                      () =>
                        assignTicket(ticket.id, {
                          version: ticket.version,
                          assigneeId: selectedAssigneeId,
                          reason: assignReason.trim() || undefined,
                        }),
                      ticket.assignee
                        ? `Đã phân công lại Ticket ${ticket.code} và lưu lịch sử.`
                        : `Đã phân công Ticket ${ticket.code} sang trạng thái ASSIGNED.`,
                    )
                  }
                >
                  {ticket.assignee
                    ? 'Lưu phân công lại (Reassign)'
                    : 'Xác nhận phân công (TRIAGED → ASSIGNED)'}
                </Button>
              </Space>
            </Card>
          )}

          {/* Bước 3: Điều chỉnh Priority có lý do và Audit (BR-02) */}
          {canOverridePriority && (
            <Card
              size="small"
              title="3. Điều chỉnh mức độ ưu tiên (Override Priority – BR-02)"
            >
              <Space direction="vertical" size={10} style={{ width: '100%' }}>
                <Typography.Text type="secondary">
                  Đổi Priority chỉ cập nhật mức ưu tiên xử lý. Deadline SLA đã chốt khi tạo Ticket được giữ nguyên.
                </Typography.Text>
                <Select
                  style={{ width: '100%' }}
                  value={overridePriorityValue}
                  options={PRIORITY_OPTIONS}
                  onChange={setOverridePriorityValue}
                />
                <Input.TextArea
                  rows={2}
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Nhập lý do điều chỉnh Priority (bắt buộc tối thiểu 3 ký tự, được lưu vào Audit Log)..."
                  maxLength={1000}
                />
                <Button
                  loading={busy}
                  disabled={
                    overrideReason.trim().length < 3 ||
                    overridePriorityValue === ticket.priority
                  }
                  onClick={() =>
                    void executeSupervisorAction(
                      () =>
                        overrideTicketPriority(ticket.id, {
                          version: ticket.version,
                          priority: overridePriorityValue,
                          reason: overrideReason.trim(),
                        }),
                      `Đã cập nhật Priority sang ${overridePriorityValue} và ghi nhận Audit.`,
                    )
                  }
                >
                  Cập nhật Priority &amp; Ghi Audit
                </Button>
              </Space>
            </Card>
          )}

          {/* Bước 4: Từ chối Ticket không hợp lệ (NEW / TRIAGED -> REJECTED) */}
          {canReject && (
            <Card
              size="small"
              title="4. Từ chối Ticket không hợp lệ (NEW / TRIAGED → REJECTED)"
            >
              <Space direction="vertical" size={10} style={{ width: '100%' }}>
                <Input.TextArea
                  rows={2}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Nhập lý do từ chối yêu cầu (bắt buộc tối thiểu 3 ký tự)..."
                  maxLength={1000}
                />
                <Popconfirm
                  title="Xác nhận từ chối Ticket này?"
                  description="Ticket sẽ chuyển sang trạng thái REJECTED kèm lý do trong lịch sử."
                  okText="Từ chối Ticket"
                  cancelText="Hủy"
                  onConfirm={() =>
                    void executeSupervisorAction(
                      () =>
                        rejectTicket(
                          ticket.id,
                          ticket.version,
                          rejectReason.trim(),
                        ),
                      `Đã từ chối Ticket ${ticket.code}.`,
                    )
                  }
                >
                  <Button
                    danger
                    loading={busy}
                    disabled={rejectReason.trim().length < 3}
                  >
                    Từ chối Ticket (Reject)
                  </Button>
                </Popconfirm>
              </Space>
            </Card>
          )}

          {/* Lịch sử thao tác & Audit Log */}
          <Card size="small" title="Lịch sử điều phối & Audit Timeline">
            {events.length === 0 ? (
              <Empty description="Chưa có sự kiện nào được ghi nhận" />
            ) : (
              <Timeline
                items={[
                  {
                    key: 'created',
                    content: (
                      <div>
                        <strong>Tạo yêu cầu mới (NEW)</strong> ·{' '}
                        {ticket.requester.fullName}
                        <div>
                          <Typography.Text
                            type="secondary"
                            style={{ fontSize: 12 }}
                          >
                            {new Date(ticket.createdAt).toLocaleString('vi-VN')}
                          </Typography.Text>
                        </div>
                      </div>
                    ),
                  },
                  ...events.map((ev) => ({
                    key: ev.id,
                    content: (
                      <div>
                        <Space wrap size={6}>
                          <strong>
                            {ev.type === 'STATUS'
                              ? `${ev.fromStatus ?? ''} → ${ev.toStatus ?? ''}`
                              : 'Bình luận'}
                          </strong>
                          {ev.actor && <Tag>{ev.actor.fullName}</Tag>}
                          {ev.visibility === 'INTERNAL' && (
                            <Tag color="purple">INTERNAL</Tag>
                          )}
                        </Space>
                        <div>
                          <Typography.Text
                            type="secondary"
                            style={{ fontSize: 12 }}
                          >
                            {new Date(ev.createdAt).toLocaleString('vi-VN')}
                          </Typography.Text>
                        </div>
                        {ev.content && (
                          <Typography.Paragraph
                            style={{ marginTop: 4, marginBottom: 0 }}
                          >
                            {ev.content}
                          </Typography.Paragraph>
                        )}
                      </div>
                    ),
                  })),
                ]}
              />
            )}
          </Card>
        </Space>
      ) : null}
    </Drawer>
  );
}
