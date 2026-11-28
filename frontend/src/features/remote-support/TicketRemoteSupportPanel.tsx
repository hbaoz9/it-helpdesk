import { useEffect, useState } from 'react';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  CopyOutlined,
  DesktopOutlined,
  DisconnectOutlined,
  LinkOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Switch,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  approveRemoteSession,
  cancelRemoteSession,
  completeRemoteSession,
  createMyDevice,
  flagTicketRemoteSupport,
  getTicketRemoteSupportContext,
  rejectRemoteSession,
  requestRemoteSession,
  startRemoteSession,
  verifyRemoteDevice,
} from '../../shared/api/remoteSupport';
import type {
  RemoteSessionStatus,
  RemoteSupportSessionRecord,
  TicketRemoteSupportContext,
  TicketStatus,
} from '../../shared/api/types';
import WebLiveRemoteConsole from './WebLiveRemoteConsole';

const SESSION_STATUS_META: Record<
  RemoteSessionStatus,
  { label: string; color: string }
> = {
  REQUESTED: { label: 'Chờ Người gửi chấp thuận', color: 'warning' },
  APPROVED: { label: 'Đã chấp thuận (Sẵn sàng kết nối)', color: 'processing' },
  IN_PROGRESS: { label: 'Đang kết nối hỗ trợ từ xa', color: 'cyan' },
  COMPLETED: { label: 'Đã hoàn tất', color: 'success' },
  REJECTED: { label: 'Người gửi đã từ chối', color: 'error' },
  CANCELLED: { label: 'Đã hủy / Hết hạn', color: 'default' },
};

const OPEN_TICKET_STATUSES: TicketStatus[] = [
  'NEW',
  'TRIAGED',
  'ASSIGNED',
  'IN_PROGRESS',
  'WAITING_REQUESTER',
];

interface TicketRemoteSupportPanelProps {
  ticketId: string;
  ticketStatus: TicketStatus;
  mode: 'requester' | 'technician' | 'supervisor';
  onActivityLogged?: () => void;
}

export default function TicketRemoteSupportPanel({
  ticketId,
  ticketStatus,
  mode,
  onActivityLogged,
}: TicketRemoteSupportPanelProps) {
  const [ctx, setCtx] = useState<TicketRemoteSupportContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  // Requester form states
  const [deviceModalOpen, setDeviceModalOpen] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [rejectReason, setRejectReason] = useState('');

  // Technician form states
  const [techDeviceId, setTechDeviceId] = useState<string>('');
  const [requestNote, setRequestNote] = useState('');
  const [resultSummary, setResultSummary] = useState('');

  // Supervisor / Cancel & Device Verification form state
  const [cancelReason, setCancelReason] = useState('');
  const [verifyNote, setVerifyNote] = useState(
    'Đã đối chiếu mã tài sản & xác nhận quyền sở hữu thiết bị với Người gửi',
  );

  const [deviceForm] = Form.useForm<{
    label: string;
    rustdeskId: string;
    osName?: string;
  }>();
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    let active = true;
    getTicketRemoteSupportContext(ticketId)
      .then((data) => {
        if (!active) return;
        setCtx(data);
        setError(null);
        const preferred =
          data.preferredDeviceId ?? data.requesterDevices[0]?.id ?? '';
        setSelectedDeviceId(preferred);
        setTechDeviceId(preferred);
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : 'Không thể tải dữ liệu Hỗ trợ từ xa RustDesk.',
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

  async function runAction(
    fn: () => Promise<unknown>,
    successMsg: string,
    afterSuccess?: () => void,
  ) {
    setBusy(true);
    try {
      await fn();
      messageApi.success(successMsg);
      afterSuccess?.();
      setRefreshTick((v) => v + 1);
      onActivityLogged?.();
    } catch (cause: unknown) {
      messageApi.error(
        cause instanceof Error ? cause.message : 'Thao tác không thành công.',
      );
      setRefreshTick((v) => v + 1);
    } finally {
      setBusy(false);
    }
  }

  function copyToClipboard(text: string, label: string) {
    void navigator.clipboard.writeText(text);
    messageApi.success(`Đã sao chép ${label}: ${text}`);
  }

  if (loading) {
    return (
      <Card
        size="small"
        title="Hỗ trợ từ xa bằng RustDesk (Open Source)"
        style={{ marginTop: 16 }}
      >
        <div style={{ textAlign: 'center', padding: 24 }}>
          <Spin />
        </div>
      </Card>
    );
  }

  if (error || !ctx) {
    return (
      <Card
        size="small"
        title="Hỗ trợ từ xa bằng RustDesk (Open Source)"
        style={{ marginTop: 16 }}
      >
        <Alert
          type="warning"
          showIcon
          message="Không thể tải thông tin Remote Support"
          description={error ?? 'Vui lòng thử lại.'}
          action={
            <Button
              size="small"
              onClick={() => setRefreshTick((v) => v + 1)}
            >
              Thử lại
            </Button>
          }
        />
      </Card>
    );
  }

  const activeSession: RemoteSupportSessionRecord | undefined =
    ctx.sessions.find((s) =>
      ['REQUESTED', 'APPROVED', 'IN_PROGRESS'].includes(s.status),
    );
  const isOpenTicket = OPEN_TICKET_STATUSES.includes(ticketStatus);
  const verifiedDevices = ctx.requesterDevices.filter(
    (d) => d.active && d.verificationStatus === 'VERIFIED',
  );

  return (
    <Card
      size="small"
      style={{ marginTop: 16 }}
      title={
        <Space>
          <DesktopOutlined style={{ color: '#2563eb' }} />
          <span>Hỗ trợ từ xa bằng RustDesk (Open Source)</span>
          {ctx.remoteSupportRequested && (
            <Tag color="blue">Người gửi đề nghị Remote Support</Tag>
          )}
        </Space>
      }
      extra={
        <Button
          size="small"
          icon={<ReloadOutlined />}
          onClick={() => setRefreshTick((v) => v + 1)}
        >
          Làm mới
        </Button>
      }
    >
      {contextHolder}

      <Space direction="vertical" size={14} style={{ width: '100%' }}>
        <Alert
          type="info"
          showIcon
          message="Phạm vi điều phối & Giới hạn bảo mật thực tế (Workflow vs. Host Enforcement)"
          description={
            ctx.consentBoundaryNotice ??
            'Phê duyệt trên SmartDesk chỉ điều tiết quy trình ITSM và tạm thời mở khóa định danh thiết nối (được che dạng ****** khi chưa phê duyệt); quyền truy cập máy tính thực tế vẫn do RustDesk Client / OS Host trên máy đích thực thi (bắt buộc có chấp thuận thật trên máy đích và xác thực Server Public Key).'
          }
        />

        {!ctx.rustdeskConfig.enabled && (
          <Alert
            type="warning"
            showIcon
            message="Tích hợp RustDesk đang tạm tắt bởi Administrator"
          />
        )}

        {/* 1. GIAO DIỆN PHÊ DUYỆT & ĐIỀU KHIỂN PHIÊN ĐANG HOẠT ĐỘNG */}
        {activeSession && (
          <Card
            size="small"
            style={{
              borderColor:
                activeSession.status === 'REQUESTED'
                  ? '#f59e0b'
                  : activeSession.status === 'APPROVED'
                    ? '#2563eb'
                    : '#0891b2',
              background: '#f8fafc',
            }}
            title={
              <Space wrap>
                <SafetyCertificateOutlined />
                <strong>Phiên hỗ trợ hiện tại:</strong>
                <Tag color={SESSION_STATUS_META[activeSession.status].color}>
                  {SESSION_STATUS_META[activeSession.status].label}
                </Tag>
              </Space>
            }
          >
            <Descriptions
              size="small"
              column={{ xs: 1, sm: 2 }}
              bordered
              style={{ marginBottom: 12 }}
            >
              <Descriptions.Item label="Thiết bị đích">
                <strong>{activeSession.deviceLabel}</strong> (ID:{' '}
                <code>{activeSession.rustdeskId}</code>)
              </Descriptions.Item>
              <Descriptions.Item label="Kỹ thuật viên yêu cầu">
                {activeSession.technician.fullName}
              </Descriptions.Item>
              <Descriptions.Item label="Thời điểm yêu cầu">
                {new Date(activeSession.requestedAt).toLocaleString('vi-VN')}
              </Descriptions.Item>
              {activeSession.approvalExpiresAt && (
                <Descriptions.Item label="Hạn hiệu lực chấp thuận">
                  {new Date(activeSession.approvalExpiresAt).toLocaleString(
                    'vi-VN',
                  )}
                </Descriptions.Item>
              )}
              {activeSession.requestNote && (
                <Descriptions.Item label="Ghi chú từ Kỹ thuật viên" span={2}>
                  {activeSession.requestNote}
                </Descriptions.Item>
              )}
            </Descriptions>

            {/* KHUNG MÀN HÌNH LIVE TRỰC TIẾP TRÊN WEB & ĐIỀU KHIỂN CHUỘT/PHÍM (KHÔNG CẦN APP RUSTDESK) */}
            {(activeSession.status === 'APPROVED' ||
              activeSession.status === 'IN_PROGRESS') && (
              <WebLiveRemoteConsole
                sessionId={activeSession.id}
                mode={mode}
                deviceLabel={activeSession.deviceLabel}
              />
            )}

            {/* REQUESTER: CHẤP THUẬN / TỪ CHỐI / NGẮT KẾT NỐI */}
            {mode === 'requester' && activeSession.status === 'REQUESTED' && (
              <Space direction="vertical" size={10} style={{ width: '100%' }}>
                <Alert
                  type="warning"
                  showIcon
                  message="Yêu cầu xác nhận quyền điều khiển từ xa (Dual-Consent)"
                  description={`Kỹ thuật viên ${activeSession.technician.fullName} xin phép kết nối RustDesk tới thiết bị "${activeSession.deviceLabel}" (ID: ${activeSession.rustdeskId}). Sau khi bạn nhấn Chấp thuận trên SmartDesk, ứng dụng RustDesk Client trên máy tính của bạn vẫn sẽ hiển thị hộp thoại xác nhận kết nối trực tiếp.`}
                />
                <Space wrap>
                  <Button
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    loading={busy}
                    onClick={() =>
                      void runAction(
                        () => approveRemoteSession(activeSession.id),
                        'Đã chấp thuận phiên hỗ trợ từ xa. Vui lòng mở ứng dụng RustDesk trên máy tính.',
                      )
                    }
                  >
                    Chấp thuận kết nối ({ctx.rustdeskConfig.approvalTtlMinutes}{' '}
                    phút)
                  </Button>
                  <Input
                    placeholder="Lý do từ chối (tùy chọn)..."
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    style={{ width: 240 }}
                  />
                  <Button
                    danger
                    icon={<CloseCircleOutlined />}
                    loading={busy}
                    onClick={() =>
                      void runAction(
                        () =>
                          rejectRemoteSession(
                            activeSession.id,
                            rejectReason.trim() || undefined,
                          ),
                        'Đã từ chối yêu cầu kết nối từ xa.',
                        () => setRejectReason(''),
                      )
                    }
                  >
                    Từ chối
                  </Button>
                </Space>
              </Space>
            )}

            {mode === 'requester' &&
              (activeSession.status === 'APPROVED' ||
                activeSession.status === 'IN_PROGRESS') && (
                <Space wrap>
                  <Alert
                    type="info"
                    showIcon
                    message={
                      activeSession.status === 'APPROVED'
                        ? 'Bạn đã chấp thuận. Kỹ thuật viên đang khởi tạo kết nối tới ứng dụng RustDesk của bạn.'
                        : 'Phiên hỗ trợ từ xa đang diễn ra. Bạn có thể chủ động kết thúc bất kỳ lúc nào trên SmartDesk hoặc trên ứng dụng RustDesk Client.'
                    }
                  />
                  <Button
                    danger
                    icon={<DisconnectOutlined />}
                    loading={busy}
                    onClick={() =>
                      void runAction(
                        () =>
                          cancelRemoteSession(
                            activeSession.id,
                            'Người gửi chủ động kết thúc phiên hỗ trợ từ xa',
                          ),
                        'Đã kết thúc phiên hỗ trợ từ xa.',
                      )
                    }
                  >
                    Kết thúc / Hủy phiên ngay
                  </Button>
                </Space>
              )}

            {/* TECHNICIAN: CHỜ CHẤP THUẬN / MỞ RUSTDESK CLIENT / GHI KẾT QUẢ */}
            {mode === 'technician' && activeSession.status === 'REQUESTED' && (
              <Space direction="vertical" size={10} style={{ width: '100%' }}>
                <Alert
                  type="info"
                  showIcon
                  message="Đang chờ Người gửi (Requester) chấp thuận trên SmartDesk"
                  description="Theo nguyên tắc bảo mật, đường dẫn khởi chạy kết nối (rustdesk://) chỉ được mở khóa sau khi Người gửi nhấn Chấp thuận."
                />
                <Button
                  danger
                  size="small"
                  loading={busy}
                  onClick={() =>
                    void runAction(
                      () =>
                        cancelRemoteSession(
                          activeSession.id,
                          'Kỹ thuật viên thu hồi yêu cầu kết nối',
                        ),
                      'Đã hủy yêu cầu kết nối.',
                    )
                  }
                >
                  Thu hồi yêu cầu
                </Button>
              </Space>
            )}

            {mode === 'technician' &&
              (activeSession.status === 'APPROVED' ||
                activeSession.status === 'IN_PROGRESS') && (
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <Alert
                    type="success"
                    showIcon
                    message={
                      activeSession.status === 'APPROVED'
                        ? 'Người gửi đã CHẤP THUẬN! Bạn có thể mở RustDesk Client và xác nhận bắt đầu phiên.'
                        : 'Phiên đang ở trạng thái IN_PROGRESS. Sau khi hỗ trợ xong trên RustDesk, hãy nhập tóm tắt kết quả bên dưới để hoàn tất.'
                    }
                    description={`Máy chủ ID (hbbs): ${ctx.rustdeskConfig.idServerHost}${
                      ctx.rustdeskConfig.relayServerHost
                        ? ` · Relay (hbbr): ${ctx.rustdeskConfig.relayServerHost}`
                        : ''
                    }${
                      ctx.rustdeskConfig.publicKey
                        ? ` · Public Key: ${ctx.rustdeskConfig.publicKey}`
                        : ''
                    }`}
                  />

                  <Space wrap>
                    {activeSession.connectUri && (
                      <Button
                        type="primary"
                        icon={<LinkOutlined />}
                        href={activeSession.connectUri}
                      >
                        Mở RustDesk Client ({activeSession.connectUri})
                      </Button>
                    )}
                    <Button
                      icon={<CopyOutlined />}
                      onClick={() =>
                        copyToClipboard(
                          activeSession.rustdeskId,
                          'RustDesk ID',
                        )
                      }
                    >
                      Copy ID ({activeSession.rustdeskId})
                    </Button>
                    {activeSession.cliCommand && (
                      <Button
                        icon={<CopyOutlined />}
                        onClick={() =>
                          copyToClipboard(
                            activeSession.cliCommand!,
                            'Lệnh CLI RustDesk',
                          )
                        }
                      >
                        Copy CLI ({activeSession.cliCommand})
                      </Button>
                    )}
                    {activeSession.status === 'APPROVED' && (
                      <Button
                        type="primary"
                        ghost
                        icon={<PlayCircleOutlined />}
                        loading={busy}
                        onClick={() =>
                          void runAction(
                            () => startRemoteSession(activeSession.id),
                            'Đã chuyển trạng thái phiên sang ĐANG KẾT NỐI (IN_PROGRESS).',
                          )
                        }
                      >
                        Xác nhận đã kết nối (Bắt đầu IN_PROGRESS)
                      </Button>
                    )}
                  </Space>

                  {activeSession.status === 'IN_PROGRESS' && (
                    <div
                      style={{
                        background: '#ffffff',
                        padding: 12,
                        borderRadius: 8,
                        border: '1px solid #e2e8f0',
                      }}
                    >
                      <Typography.Text strong>
                        Ghi nhận kết quả xử lý từ xa vào Ticket:
                      </Typography.Text>
                      <Input.TextArea
                        rows={2}
                        style={{ marginTop: 6, marginBottom: 8 }}
                        value={resultSummary}
                        onChange={(e) => setResultSummary(e.target.value)}
                        placeholder="Mô tả công việc đã xử lý qua phiên RustDesk (tối thiểu 3 ký tự)..."
                        maxLength={2000}
                      />
                      <Space>
                        <Button
                          type="primary"
                          icon={<CheckCircleOutlined />}
                          loading={busy}
                          disabled={resultSummary.trim().length < 3}
                          onClick={() =>
                            void runAction(
                              () =>
                                completeRemoteSession(
                                  activeSession.id,
                                  resultSummary.trim(),
                                ),
                              'Đã hoàn tất phiên hỗ trợ từ xa và ghi kết quả vào Ticket.',
                              () => setResultSummary(''),
                            )
                          }
                        >
                          Kết thúc phiên &amp; Lưu kết quả
                        </Button>
                        <Button
                          danger
                          loading={busy}
                          onClick={() =>
                            void runAction(
                              () =>
                                cancelRemoteSession(
                                  activeSession.id,
                                  'Kỹ thuật viên hủy phiên đang diễn ra',
                                ),
                              'Đã hủy phiên hỗ trợ.',
                            )
                          }
                        >
                          Hủy phiên
                        </Button>
                      </Space>
                    </div>
                  )}
                </Space>
              )}

            {/* SUPERVISOR: GIÁM SÁT & HỦY PHIÊN TREO */}
            {mode === 'supervisor' && (
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Quy tắc bảo mật: Supervisor chỉ giám sát trạng thái và có
                  quyền hủy phiên bị treo (kèm lý do Audit), không được phép
                  chấp thuận thay Người gửi hoặc điều khiển thiết bị.
                </Typography.Text>
                <Space wrap>
                  <Input
                    placeholder="Nhập lý do hủy phiên bị treo (tối thiểu 3 ký tự)..."
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    style={{ width: 320 }}
                  />
                  <Popconfirm
                    title="Xác nhận hủy phiên hỗ trợ từ xa này?"
                    onConfirm={() =>
                      void runAction(
                        () =>
                          cancelRemoteSession(
                            activeSession.id,
                            cancelReason.trim(),
                          ),
                        'Đã hủy phiên hỗ trợ từ xa và ghi Audit Log.',
                        () => setCancelReason(''),
                      )
                    }
                  >
                    <Button
                      danger
                      loading={busy}
                      disabled={cancelReason.trim().length < 3}
                    >
                      Đóng / Hủy phiên treo (Supervisor)
                    </Button>
                  </Popconfirm>
                </Space>
              </Space>
            )}
          </Card>
        )}

        {/* 2. REQUESTER: QUẢN LÝ THIẾT BỊ & BẬT CỜ ĐỀ NGHỊ HỖ TRỢ TỪ XA */}
        {mode === 'requester' && isOpenTicket && (
          <div
            style={{
              background: '#f8fafc',
              padding: 12,
              borderRadius: 8,
              border: '1px solid #e2e8f0',
            }}
          >
            <Space
              direction="vertical"
              size={10}
              style={{ width: '100%' }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                <div>
                  <Typography.Text strong>
                    Thiết bị cá nhân &amp; Yêu cầu hỗ trợ từ xa
                  </Typography.Text>
                  <div>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      Máy chủ ID nội bộ:{' '}
                      <code>{ctx.rustdeskConfig.idServerHost}</code>
                      {ctx.rustdeskConfig.clientGuideUrl && (
                        <>
                          {' · '}
                          <a
                            href={ctx.rustdeskConfig.clientGuideUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Hướng dẫn cài đặt RustDesk Client
                          </a>
                        </>
                      )}
                    </Typography.Text>
                  </div>
                </div>
                <Button
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    deviceForm.resetFields();
                    setDeviceModalOpen(true);
                  }}
                >
                  Đăng ký thiết bị RustDesk
                </Button>
              </div>

              <Space wrap>
                <Select
                  style={{ minWidth: 280 }}
                  placeholder="Chọn thiết bị của bạn..."
                  value={selectedDeviceId || undefined}
                  onChange={setSelectedDeviceId}
                  options={ctx.requesterDevices.map((d) => ({
                    value: d.id,
                    disabled: !d.active,
                    label: `${d.label} — ID: ${d.rustdeskId}${
                      d.osName ? ` (${d.osName})` : ''
                    } [${
                      d.verificationStatus === 'VERIFIED'
                        ? 'VERIFIED: Đã xác minh'
                        : d.verificationStatus === 'PENDING'
                          ? 'PENDING: Tự khai báo - Chờ IT xác minh'
                          : 'REVOKED: Đã thu hồi'
                    }]`,
                  }))}
                />
                <Switch
                  checked={ctx.remoteSupportRequested}
                  checkedChildren="Đang bật yêu cầu Remote"
                  unCheckedChildren="Tắt yêu cầu Remote"
                  disabled={busy}
                  onChange={(checked) =>
                    void runAction(
                      () =>
                        flagTicketRemoteSupport(ticketId, {
                          remoteSupportRequested: checked,
                          preferredDeviceId: checked
                            ? selectedDeviceId || null
                            : null,
                        }),
                      checked
                        ? 'Đã bật đề nghị Hỗ trợ từ xa trên Ticket này.'
                        : 'Đã tắt đề nghị Hỗ trợ từ xa.',
                    )
                  }
                />
                {ctx.remoteSupportRequested &&
                  selectedDeviceId &&
                  selectedDeviceId !== ctx.preferredDeviceId && (
                    <Button
                      size="small"
                      type="primary"
                      loading={busy}
                      onClick={() =>
                        void runAction(
                          () =>
                            flagTicketRemoteSupport(ticketId, {
                              remoteSupportRequested: true,
                              preferredDeviceId: selectedDeviceId,
                            }),
                          'Đã cập nhật thiết bị ưu tiên cho Ticket.',
                        )
                      }
                    >
                      Cập nhật thiết bị ưu tiên
                    </Button>
                  )}
              </Space>
            </Space>
          </div>
        )}

        {/* 3. TECHNICIAN: GỬI YÊU CẦU HỖ TRỢ TỪ XA MỚI */}
        {mode === 'technician' &&
          !activeSession &&
          (ticketStatus === 'ASSIGNED' || ticketStatus === 'IN_PROGRESS') && (
            <div
              style={{
                background: '#f8fafc',
                padding: 12,
                borderRadius: 8,
                border: '1px solid #e2e8f0',
              }}
            >
              <Typography.Text strong>
                Khởi tạo yêu cầu Hỗ trợ từ xa (RustDesk)
              </Typography.Text>
              {verifiedDevices.length === 0 ? (
                <Alert
                  style={{ marginTop: 8 }}
                  type="info"
                  showIcon
                  message="Người gửi chưa có thiết bị RustDesk nào được xác minh (VERIFIED)"
                  description="Hãy hướng dẫn Người gửi đăng ký RustDesk ID trong trang Chi tiết Ticket của họ."
                />
              ) : (
                <Space
                  direction="vertical"
                  size={10}
                  style={{ width: '100%', marginTop: 8 }}
                >
                  <Select
                    style={{ width: '100%' }}
                    placeholder="Chọn thiết bị đã xác minh của Người gửi..."
                    value={techDeviceId || undefined}
                    onChange={setTechDeviceId}
                    options={verifiedDevices.map((d) => ({
                      value: d.id,
                      label: `${d.label} — RustDesk ID: ${d.rustdeskId}${
                        d.osName ? ` (${d.osName})` : ''
                      }${
                        d.id === ctx.preferredDeviceId
                          ? ' [Thiết bị Người gửi ưu tiên]'
                          : ''
                      }`,
                    }))}
                  />
                  <Input
                    value={requestNote}
                    onChange={(e) => setRequestNote(e.target.value)}
                    placeholder="Ghi chú gửi tới Người gửi (ví dụ: Xin phép kiểm tra cấu hình máy in / VPN)..."
                    maxLength={500}
                  />
                  <Button
                    type="primary"
                    icon={<DesktopOutlined />}
                    loading={busy}
                    disabled={!techDeviceId || !ctx.rustdeskConfig.enabled}
                    onClick={() =>
                      void runAction(
                        () =>
                          requestRemoteSession(ticketId, {
                            deviceId: techDeviceId,
                            requestNote: requestNote.trim() || undefined,
                          }),
                        'Đã gửi yêu cầu kết nối từ xa tới Người gửi. Vui lòng chờ Người gửi chấp thuận.',
                        () => setRequestNote(''),
                      )
                    }
                  >
                    Gửi yêu cầu Hỗ trợ từ xa (Chờ Requester chấp thuận)
                  </Button>
                </Space>
              )}
            </div>
          )}

        {/* 3B. SUPERVISOR: XÁC MINH QUYỀN SỞ HỮU THIẾT BỊ TỰ KHAI BÁO (PENDING -> VERIFIED / REVOKED) */}
        {mode === 'supervisor' && ctx.requesterDevices.length > 0 && (
          <div
            style={{
              background: '#f8fafc',
              padding: 12,
              borderRadius: 8,
              border: '1px solid #e2e8f0',
            }}
          >
            <Typography.Text strong>
              Quản lý &amp; Xác minh Thiết bị của Người gửi (
              {ctx.requesterDevices.length})
            </Typography.Text>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
              Thiết bị do Người gửi tự đăng ký sẽ ở trạng thái{' '}
              <code>PENDING</code> (Tự khai báo). Supervisor/Admin cần đối chiếu
              và xác minh quyền sở hữu (<code>VERIFIED</code>) trước khi Kỹ
              thuật viên được phép gửi yêu cầu kết nối.
            </div>
            <Input
              size="small"
              value={verifyNote}
              onChange={(e) => setVerifyNote(e.target.value)}
              placeholder="Ghi chú xác minh / thu hồi thiết bị (tối thiểu 3 ký tự, lưu Audit Log)..."
              style={{ marginBottom: 8 }}
            />
            <Space direction="vertical" size={6} style={{ width: '100%' }}>
              {ctx.requesterDevices.map((dev) => (
                <div
                  key={dev.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 8,
                    padding: '6px 10px',
                    background: '#ffffff',
                    borderRadius: 6,
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <Space wrap>
                    <strong>{dev.label}</strong>
                    <code>ID: {dev.rustdeskId}</code>
                    <Tag
                      color={
                        dev.verificationStatus === 'VERIFIED'
                          ? 'success'
                          : dev.verificationStatus === 'PENDING'
                            ? 'warning'
                            : 'error'
                      }
                    >
                      {dev.verificationStatus === 'VERIFIED'
                        ? 'VERIFIED (Đã xác minh)'
                        : dev.verificationStatus === 'PENDING'
                          ? 'PENDING (Tự khai báo - Chờ xác minh)'
                          : 'REVOKED (Đã thu hồi)'}
                    </Tag>
                  </Space>
                  <Space size={6}>
                    {dev.verificationStatus !== 'VERIFIED' && (
                      <Button
                        size="small"
                        type="primary"
                        loading={busy}
                        disabled={verifyNote.trim().length < 3}
                        onClick={() =>
                          void runAction(
                            () =>
                              verifyRemoteDevice(dev.id, {
                                verificationStatus: 'VERIFIED',
                                reason: verifyNote.trim(),
                              }),
                            `Đã xác minh quyền sở hữu thiết bị "${dev.label}" (VERIFIED).`,
                          )
                        }
                      >
                        Xác minh (VERIFIED)
                      </Button>
                    )}
                    {dev.verificationStatus !== 'REVOKED' && (
                      <Button
                        size="small"
                        danger
                        loading={busy}
                        disabled={verifyNote.trim().length < 3}
                        onClick={() =>
                          void runAction(
                            () =>
                              verifyRemoteDevice(dev.id, {
                                verificationStatus: 'REVOKED',
                                reason: verifyNote.trim(),
                              }),
                            `Đã thu hồi xác minh thiết bị "${dev.label}" (REVOKED).`,
                          )
                        }
                      >
                        Thu hồi (REVOKED)
                      </Button>
                    )}
                  </Space>
                </div>
              ))}
            </Space>
          </div>
        )}

        {/* 4. LỊCH SỬ CÁC PHIÊN HỖ TRỢ TỪ XA CỦA TICKET */}
        <div>
          <Typography.Text strong style={{ fontSize: 13 }}>
            Lịch sử phiên Hỗ trợ từ xa ({ctx.sessions.length})
          </Typography.Text>
          {ctx.sessions.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Chưa có phiên hỗ trợ từ xa nào trên Ticket này"
              style={{ margin: '12px 0' }}
            />
          ) : (
            <Space
              direction="vertical"
              size={8}
              style={{ width: '100%', marginTop: 8 }}
            >
              {ctx.sessions.map((s) => (
                <div
                  key={s.id}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid #e2e8f0',
                    background: '#ffffff',
                    fontSize: 13,
                  }}
                >
                  <Space wrap style={{ justifyContent: 'space-between', width: '100%' }}>
                    <Space wrap>
                      <Tag color={SESSION_STATUS_META[s.status].color}>
                        {SESSION_STATUS_META[s.status].label}
                      </Tag>
                      <strong>{s.deviceLabel}</strong>
                      <code>ID: {s.rustdeskId}</code>
                      <span>· Kỹ thuật viên: {s.technician.fullName}</span>
                    </Space>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {new Date(s.requestedAt).toLocaleString('vi-VN')}
                    </Typography.Text>
                  </Space>
                  {s.resultSummary && (
                    <div style={{ marginTop: 4, color: '#0f766e' }}>
                      <strong>Kết quả xử lý:</strong> {s.resultSummary}
                    </div>
                  )}
                  {s.rejectionReason && (
                    <div style={{ marginTop: 4, color: '#b91c1c' }}>
                      <strong>Lý do từ chối:</strong> {s.rejectionReason}
                    </div>
                  )}
                  {s.cancelReason && (
                    <div style={{ marginTop: 4, color: '#64748b' }}>
                      <strong>Lý do hủy:</strong> {s.cancelReason}
                    </div>
                  )}
                </div>
              ))}
            </Space>
          )}
        </div>
      </Space>

      {/* Modal Đăng ký thiết bị RustDesk cho Requester */}
      <Modal
        title="Đăng ký thiết bị cá nhân cần hỗ trợ (RustDesk)"
        open={deviceModalOpen}
        onCancel={() => setDeviceModalOpen(false)}
        footer={null}
        destroyOnHidden
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 14 }}
          message="Quy trình Tự khai báo & Xác minh Thiết bị (Device Verification)"
          description="Thiết bị mới đăng ký sẽ ở trạng thái PENDING (Tự khai báo - Chờ xác minh) để tránh mạo danh ID. Sau khi IT Supervisor hoặc Administrator đối chiếu và xác minh (VERIFIED), Kỹ thuật viên mới có thể gửi yêu cầu hỗ trợ từ xa."
        />
        <Form
          form={deviceForm}
          layout="vertical"
          onFinish={(values) =>
            void runAction(
              async () => {
                const created = await createMyDevice(values);
                setSelectedDeviceId(created.id);
                setDeviceModalOpen(false);
              },
              'Đã đăng ký thiết bị ở trạng thái PENDING (Chờ IT Supervisor/Admin xác minh quyền sở hữu).',
            )
          }
        >
          <Form.Item
            label="Tên gợi nhớ của thiết bị"
            name="label"
            rules={[
              { required: true, message: 'Vui lòng nhập tên thiết bị.' },
              { min: 2, message: 'Tối thiểu 2 ký tự.' },
            ]}
          >
            <Input placeholder="Ví dụ: Laptop Dell Phòng Kế Toán" />
          </Form.Item>
          <Form.Item
            label="RustDesk ID (6–20 ký tự số/chữ hiển thị trên ứng dụng RustDesk)"
            name="rustdeskId"
            rules={[
              { required: true, message: 'Vui lòng nhập RustDesk ID.' },
              {
                min: 6,
                message: 'RustDesk ID phải có từ 6 ký tự trở lên.',
              },
            ]}
          >
            <Input placeholder="Ví dụ: 102 938 475" />
          </Form.Item>
          <Form.Item label="Hệ điều hành (Tùy chọn)" name="osName">
            <Input placeholder="Ví dụ: Windows 11 Pro / macOS Sonoma" />
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setDeviceModalOpen(false)}>Hủy</Button>
            <Button type="primary" htmlType="submit" loading={busy}>
              Lưu thiết bị
            </Button>
          </div>
        </Form>
      </Modal>
    </Card>
  );
}
