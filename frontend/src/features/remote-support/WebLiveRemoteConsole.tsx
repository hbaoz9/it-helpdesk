import { useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import {
  AimOutlined,
  DesktopOutlined,
  ExpandOutlined,
  CompressOutlined,
  SendOutlined,
  StopOutlined,
  ThunderboltOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Badge,
  Button,
  Card,
  Input,
  Radio,
  Space,
  Switch,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import {
  getLiveSessionState,
  pushLiveFrame,
  sendRemoteInput,
  updateLiveControlSettings,
} from '../../shared/api/remoteSupport';
import type {
  LiveSessionStateRecord,
  RemoteInputKind,
} from '../../shared/api/types';

interface WebLiveRemoteConsoleProps {
  sessionId: string;
  mode: 'requester' | 'technician' | 'supervisor';
  deviceLabel: string;
}

const INPUT_KIND_LABELS: Record<RemoteInputKind, string> = {
  LASER: 'Chiếu Tia Laser chỉ dẫn',
  MOVE: 'Di chuyển con trỏ chuột',
  LEFT_CLICK: 'Click chuột trái',
  RIGHT_CLICK: 'Click chuột phải',
  DOUBLE_CLICK: 'Click đúp chuột trái',
  KEY: 'Bấm phím chức năng',
  TEXT: 'Gõ văn bản từ xa',
};

const QUICK_KEYS = [
  { key: 'ENTER', label: 'Enter ↵' },
  { key: 'BACKSPACE', label: 'Backspace ⌫' },
  { key: 'TAB', label: 'Tab ⇥' },
  { key: 'ESCAPE', label: 'Esc' },
  { key: 'UP', label: '↑' },
  { key: 'DOWN', label: '↓' },
  { key: 'LEFT', label: '←' },
  { key: 'RIGHT', label: '→' },
];

export default function WebLiveRemoteConsole({
  sessionId,
  mode,
  deviceLabel,
}: WebLiveRemoteConsoleProps) {
  const [live, setLive] = useState<LiveSessionStateRecord | null>(null);
  const [sharingLocalScreen, setSharingLocalScreen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [techTool, setTechTool] = useState<
    'LASER' | 'LEFT_CLICK' | 'DOUBLE_CLICK' | 'RIGHT_CLICK'
  >('LASER');
  const [remoteText, setRemoteText] = useState('');
  const [sendingInput, setSendingInput] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const captureTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastHoverSentRef = useRef<number>(0);

  const [messageApi, contextHolder] = message.useMessage();

  // Poll live state every 350ms while session is active
  useEffect(() => {
    let active = true;

    const fetchState = () => {
      getLiveSessionState(sessionId, false)
        .then((data) => {
          if (active) {
            setLive(data);
          }
        })
        .catch(() => {
          /* ignore transient poll error */
        });
    };

    fetchState();
    const timer = setInterval(fetchState, 350);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [sessionId]);

  // Cleanup screen capture stream on unmount
  useEffect(() => {
    return () => {
      if (captureTimerRef.current) {
        clearInterval(captureTimerRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  async function stopScreenShare() {
    if (captureTimerRef.current) {
      clearInterval(captureTimerRef.current);
      captureTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setSharingLocalScreen(false);
    try {
      const updated = await updateLiveControlSettings(sessionId, {
        streaming: false,
        remoteControlEnabled: false,
      });
      setLive(updated);
      messageApi.info('Đã dừng phát màn hình trực tiếp trên Web.');
    } catch {
      /* ignore */
    }
  }

  async function startScreenShare() {
    if (
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getDisplayMedia !== 'function'
    ) {
      messageApi.error(
        'Trình duyệt của bạn không hỗ trợ WebRTC getDisplayMedia.',
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: { ideal: 12, max: 20 },
          width: { ideal: 1280, max: 1600 },
        },
        audio: false,
      });

      streamRef.current = stream;
      setSharingLocalScreen(true);

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          void stopScreenShare();
        };
      }

      const videoEl = videoRef.current;
      if (videoEl) {
        videoEl.srcObject = stream;
        await videoEl.play();
      }

      await updateLiveControlSettings(sessionId, { streaming: true });
      messageApi.success(
        'Đang phát màn hình trực tiếp lên giao diện Web của Kỹ thuật viên!',
      );

      captureTimerRef.current = setInterval(() => {
        const v = videoRef.current;
        const c = canvasRef.current;
        if (!v || !c || v.readyState < 2 || v.videoWidth === 0) {
          return;
        }

        const maxWidth = 1280;
        const scale = Math.min(1, maxWidth / v.videoWidth);
        const targetW = Math.round(v.videoWidth * scale);
        const targetH = Math.round(v.videoHeight * scale);

        c.width = targetW;
        c.height = targetH;
        const ctx2d = c.getContext('2d');
        if (!ctx2d) return;

        ctx2d.drawImage(v, 0, 0, targetW, targetH);
        const frameDataUrl = c.toDataURL('image/jpeg', 0.62);

        void pushLiveFrame(sessionId, {
          frameDataUrl,
          width: targetW,
          height: targetH,
        }).catch(() => {
          /* ignore frame drop */
        });
      }, 280);
    } catch (cause) {
      setSharingLocalScreen(false);
      messageApi.warning(
        cause instanceof Error
          ? `Không thể bắt đầu chia sẻ màn hình: ${cause.message}`
          : 'Bạn đã hủy hộp thoại chọn màn hình.',
      );
    }
  }

  async function handleToggleRemoteControl(enabled: boolean) {
    try {
      const updated = await updateLiveControlSettings(sessionId, {
        remoteControlEnabled: enabled,
        executeOnHostOs: true,
      });
      setLive(updated);
      messageApi.success(
        enabled
          ? 'Đã CHO PHÉP Kỹ thuật viên điều khiển Chuột & Bàn phím từ trang Web!'
          : 'Đã THU HỒI quyền điều khiển Chuột & Bàn phím (Chỉ cho phép xem & Tia Laser).',
      );
    } catch (cause) {
      messageApi.error(
        cause instanceof Error
          ? cause.message
          : 'Không thể cập nhật quyền điều khiển.',
      );
    }
  }

  async function handleViewportClick(e: MouseEvent<HTMLDivElement>) {
    if (mode !== 'technician') return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const xRatio = Math.max(
      0,
      Math.min(1, (e.clientX - rect.left) / rect.width),
    );
    const yRatio = Math.max(
      0,
      Math.min(1, (e.clientY - rect.top) / rect.height),
    );

    const kindToSend: RemoteInputKind =
      techTool !== 'LASER' && !live?.remoteControlEnabled ? 'LASER' : techTool;

    try {
      await sendRemoteInput(sessionId, {
        kind: kindToSend,
        xRatio,
        yRatio,
      });
      if (techTool !== 'LASER' && !live?.remoteControlEnabled) {
        messageApi.warning(
          'Người gửi chưa bật công tắc "Cho phép Điều khiển Chuột & Bàn phím" nên hệ thống chỉ chiếu Tia Laser chỉ dẫn.',
        );
      }
    } catch (cause) {
      messageApi.error(
        cause instanceof Error ? cause.message : 'Lỗi gửi thao tác từ xa.',
      );
    }
  }

  function handleViewportMouseMove(e: MouseEvent<HTMLDivElement>) {
    if (mode !== 'technician') return;
    const now = Date.now();
    if (now - lastHoverSentRef.current < 160) return;
    lastHoverSentRef.current = now;

    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const xRatio = Math.max(
      0,
      Math.min(1, (e.clientX - rect.left) / rect.width),
    );
    const yRatio = Math.max(
      0,
      Math.min(1, (e.clientY - rect.top) / rect.height),
    );

    void sendRemoteInput(sessionId, {
      kind: 'LASER',
      xRatio,
      yRatio,
    }).catch(() => {
      /* ignore */
    });
  }

  async function handleSendKey(key: string) {
    if (!live?.remoteControlEnabled) {
      messageApi.warning(
        'Người gửi cần bật "Cho phép Điều khiển Chuột & Bàn phím" trước.',
      );
      return;
    }
    setSendingInput(true);
    try {
      await sendRemoteInput(sessionId, { kind: 'KEY', key });
      messageApi.success(`Đã gửi phím ${key} sang máy Người gửi.`);
    } catch (cause) {
      messageApi.error(
        cause instanceof Error ? cause.message : 'Không thể gửi phím.',
      );
    } finally {
      setSendingInput(false);
    }
  }

  async function handleSendText() {
    if (!remoteText.trim()) return;
    if (!live?.remoteControlEnabled) {
      messageApi.warning(
        'Người gửi cần bật "Cho phép Điều khiển Chuột & Bàn phím" trước.',
      );
      return;
    }
    setSendingInput(true);
    try {
      await sendRemoteInput(sessionId, {
        kind: 'TEXT',
        text: remoteText,
      });
      setRemoteText('');
      messageApi.success('Đã gõ văn bản từ xa sang máy Người gửi.');
    } catch (cause) {
      messageApi.error(
        cause instanceof Error ? cause.message : 'Không thể gửi văn bản.',
      );
    } finally {
      setSendingInput(false);
    }
  }

  const pointerActive = Boolean(live?.laserPointer);

  return (
    <Card
      size="small"
      style={{
        marginTop: 12,
        borderColor: '#0284c7',
        background: '#0f172a',
        color: '#f8fafc',
      }}
      styles={{
        header: {
          borderBottom: '1px solid #1e293b',
          color: '#f8fafc',
        },
      }}
      title={
        <Space wrap>
          <VideoCameraOutlined style={{ color: '#38bdf8' }} />
          <span style={{ color: '#f8fafc', fontWeight: 600 }}>
            Màn hình Hỗ trợ Trực tiếp ngay trên Web (SmartDesk WebRTC + Win32
            Control)
          </span>
          {live?.streaming ? (
            <Badge
              status="processing"
              text={
                <span style={{ color: '#4ade80', fontSize: 12 }}>
                  LIVE ({live.frameWidth}×{live.frameHeight})
                </span>
              }
            />
          ) : (
            <Tag color="default">Chưa phát màn hình</Tag>
          )}
          {live?.remoteControlEnabled ? (
            <Tag color="red" icon={<ThunderboltOutlined />}>
              ĐANG MỞ ĐIỀU KHIỂN CHUỘT &amp; PHÍM THẬT
            </Tag>
          ) : (
            <Tag color="blue" icon={<AimOutlined />}>
              Chế độ Xem &amp; Tia Laser chỉ dẫn
            </Tag>
          )}
        </Space>
      }
      extra={
        <Button
          size="small"
          type="text"
          style={{ color: '#e2e8f0' }}
          icon={expanded ? <CompressOutlined /> : <ExpandOutlined />}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? 'Thu nhỏ' : 'Mở rộng khung hình'}
        </Button>
      }
    >
      {contextHolder}
      {/* Hidden video & canvas elements used by Requester browser to capture screen frames */}
      <video
        ref={videoRef}
        muted
        playsInline
        style={{ display: 'none' }}
      />
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        {/* 1. THANH CÔNG CỤ CỦA NGƯỜI GỬI (REQUESTER) */}
        {mode === 'requester' && (
          <div
            style={{
              background: '#1e293b',
              padding: 12,
              borderRadius: 8,
              border: '1px solid #334155',
            }}
          >
            <Space
               wrap
              style={{
                justifyContent: 'space-between',
                width: '100%',
                alignItems: 'center',
              }}
            >
              <Space wrap size={12}>
                {!sharingLocalScreen ? (
                  <Button
                    type="primary"
                    icon={<DesktopOutlined />}
                    onClick={() => void startScreenShare()}
                  >
                    🎥 Phát màn hình trực tiếp lên Web (Không cần cài App)
                  </Button>
                ) : (
                  <Button
                    danger
                    icon={<StopOutlined />}
                    onClick={() => void stopScreenShare()}
                  >
                    Dừng phát màn hình
                  </Button>
                )}

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: '#0f172a',
                    padding: '6px 12px',
                    borderRadius: 6,
                    border: '1px solid #475569',
                  }}
                >
                  <Switch
                    checked={Boolean(live?.remoteControlEnabled)}
                    onChange={(checked) =>
                      void handleToggleRemoteControl(checked)
                    }
                    checkedChildren="Cho phép Điều khiển Chuột/Phím"
                    unCheckedChildren="Khóa Điều khiển Chuột/Phím"
                  />
                  <Typography.Text style={{ color: '#cbd5e1', fontSize: 12 }}>
                    {live?.remoteControlEnabled
                      ? 'Kỹ thuật viên có thể click chuột & gõ phím từ Web'
                      : 'Kỹ thuật viên chỉ xem được màn hình & chiếu Tia Laser'}
                  </Typography.Text>
                </div>
              </Space>
            </Space>
          </div>
        )}

        {/* 2. THANH CÔNG CỤ ĐIỀU KHIỂN CỦA KỸ THUẬT VIÊN (TECHNICIAN) */}
        {mode === 'technician' && (
          <div
            style={{
              background: '#1e293b',
              padding: 12,
              borderRadius: 8,
              border: '1px solid #334155',
            }}
          >
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              <Space
                wrap
                style={{
                  justifyContent: 'space-between',
                  width: '100%',
                }}
              >
                <Space wrap>
                  <Typography.Text style={{ color: '#cbd5e1', fontSize: 13 }}>
                    Công cụ khi Click lên màn hình Web:
                  </Typography.Text>
                  <Radio.Group
                    size="small"
                    optionType="button"
                    buttonStyle="solid"
                    value={techTool}
                    onChange={(e) => setTechTool(e.target.value)}
                    options={[
                      {
                        value: 'LASER',
                        label: '🔴 Tia Laser chỉ dẫn',
                      },
                      {
                        value: 'LEFT_CLICK',
                        label: '🖱️ Click Trái thật',
                      },
                      {
                        value: 'DOUBLE_CLICK',
                        label: '⚡ Double Click',
                      },
                      {
                        value: 'RIGHT_CLICK',
                        label: '🖱️ Click Phải',
                      },
                    ]}
                  />
                </Space>

                <Space wrap size={4}>
                  {QUICK_KEYS.map((item) => (
                    <Tooltip
                      key={item.key}
                      title={`Gửi phím ${item.label} tới máy ${deviceLabel}`}
                    >
                      <Button
                        size="small"
                        disabled={!live?.remoteControlEnabled || sendingInput}
                        onClick={() => void handleSendKey(item.key)}
                      >
                        {item.label}
                      </Button>
                    </Tooltip>
                  ))}
                </Space>
              </Space>

              <Space.Compact style={{ width: '100%' }}>
                <Input
                  placeholder={
                    live?.remoteControlEnabled
                      ? 'Nhập lệnh hoặc văn bản để gõ trực tiếp vào cửa sổ đang mở trên máy Người gửi...'
                      : 'Yêu cầu Người gửi bật công tắc "Cho phép Điều khiển Chuột/Phím" để gõ phím từ xa...'
                  }
                  disabled={!live?.remoteControlEnabled || sendingInput}
                  value={remoteText}
                  onChange={(e) => setRemoteText(e.target.value)}
                  onPressEnter={() => void handleSendText()}
                  maxLength={200}
                />
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  disabled={
                    !live?.remoteControlEnabled ||
                    !remoteText.trim() ||
                    sendingInput
                  }
                  onClick={() => void handleSendText()}
                >
                  Gõ văn bản từ xa
                </Button>
              </Space.Compact>
            </Space>
          </div>
        )}

        {/* 3. KHUNG HIỂN THỊ MÀN HÌNH TRỰC TIẾP (LIVE VIEWPORT) + TIA LASER ĐỎ */}
        <div
          onClick={(e) => void handleViewportClick(e)}
          onMouseMove={handleViewportMouseMove}
          style={{
            position: 'relative',
            width: '100%',
            minHeight: expanded ? 620 : 380,
            maxHeight: expanded ? '82vh' : 500,
            background: '#020617',
            borderRadius: 8,
            border: '1px solid #334155',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor:
              mode === 'technician'
                ? techTool === 'LASER'
                  ? 'crosshair'
                  : 'pointer'
                : 'default',
          }}
        >
          {live?.streaming && live.frameDataUrl ? (
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <img
                src={live.frameDataUrl}
                alt="Live Remote Screen"
                draggable={false}
                style={{
                  width: '100%',
                  height: 'auto',
                  maxHeight: expanded ? '80vh' : 480,
                  objectFit: 'contain',
                  userSelect: 'none',
                  display: 'block',
                }}
              />

              {/* Lớp phủ Tia Laser & Hiệu ứng Click của Kỹ thuật viên */}
              {pointerActive && live.laserPointer && (
                <div
                  style={{
                    position: 'absolute',
                    left: `${(live.laserPointer.xRatio * 100).toFixed(2)}%`,
                    top: `${(live.laserPointer.yRatio * 100).toFixed(2)}%`,
                    transform: 'translate(-50%, -50%)',
                    pointerEvents: 'none',
                    zIndex: 10,
                  }}
                >
                  <div
                    style={{
                      width:
                        live.laserPointer.kind === 'LASER' ? 20 : 28,
                      height:
                        live.laserPointer.kind === 'LASER' ? 20 : 28,
                      borderRadius: '50%',
                      background:
                        live.laserPointer.kind === 'LASER'
                          ? 'rgba(239, 68, 68, 0.88)'
                          : 'rgba(56, 189, 248, 0.85)',
                      border: '2px solid #ffffff',
                      boxShadow:
                        live.laserPointer.kind === 'LASER'
                          ? '0 0 16px 6px rgba(239, 68, 68, 0.75)'
                          : '0 0 18px 8px rgba(56, 189, 248, 0.8)',
                    }}
                  />
                  <div
                    style={{
                      marginTop: 4,
                      background: 'rgba(15, 23, 42, 0.9)',
                      color: '#f8fafc',
                      padding: '2px 6px',
                      borderRadius: 4,
                      fontSize: 11,
                      whiteSpace: 'nowrap',
                      border: '1px solid #475569',
                    }}
                  >
                    {live.laserPointer.actorName} ·{' '}
                    {INPUT_KIND_LABELS[live.laserPointer.kind]}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>
              <DesktopOutlined style={{ fontSize: 40, color: '#38bdf8' }} />
              <div
                style={{
                  marginTop: 12,
                  fontSize: 15,
                  fontWeight: 600,
                  color: '#e2e8f0',
                }}
              >
                {mode === 'requester'
                  ? 'Bấm nút "🎥 Phát màn hình trực tiếp lên Web" ở phía trên để Kỹ thuật viên nhìn thấy màn hình ngay trên trình duyệt'
                  : 'Đang chờ Người gửi bấm nút "🎥 Phát màn hình trực tiếp lên Web"...'}
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: '#64748b' }}>
                Hoạt động 100% ngay trên trình duyệt Chrome / Edge (WebRTC),
                không cần cài đặt RustDesk Client.
              </div>
            </div>
          )}
        </div>

        {/* 4. NHẬT KÝ THAO TÁC ĐIỀU KHIỂN THỜI GIAN THỰC */}
        {live && live.recentInputs.length > 0 && (
          <Alert
            type="info"
            showIcon
            message={`Thao tác điều khiển gần nhất trên Web: ${
              INPUT_KIND_LABELS[live.recentInputs[0].kind]
            }${
              live.recentInputs[0].key
                ? ` [${live.recentInputs[0].key}]`
                : ''
            }${
              live.recentInputs[0].text
                ? ` ("${live.recentInputs[0].text}")`
                : ''
            } bởi ${live.recentInputs[0].actorName} ${
              live.recentInputs[0].executedOnOs
                ? '— Đã thực thi trên Windows OS (user32.dll)'
                : ''
            }`}
          />
        )}
      </Space>
    </Card>
  );
}
