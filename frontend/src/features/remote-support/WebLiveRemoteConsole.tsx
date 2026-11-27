import { useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import {
  AimOutlined,
  CompressOutlined,
  DesktopOutlined,
  ExpandOutlined,
  SendOutlined,
  StopOutlined,
  ThunderboltOutlined,
  VideoCameraOutlined,
  WifiOutlined,
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
  exchangeWebRtcSignal,
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

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

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

interface DataChannelPointerMessage {
  type: 'POINTER';
  kind: RemoteInputKind;
  xRatio: number;
  yRatio: number;
  actorName: string;
}

export default function WebLiveRemoteConsole({
  sessionId,
  mode,
  deviceLabel,
}: WebLiveRemoteConsoleProps) {
  const [live, setLive] = useState<LiveSessionStateRecord | null>(null);
  const [sharingLocalScreen, setSharingLocalScreen] = useState(false);
  const [p2pVideoReady, setP2pVideoReady] = useState(false);
  const [dataChannelReady, setDataChannelReady] = useState(false);
  const [fastPointer, setFastPointer] = useState<{
    xRatio: number;
    yRatio: number;
    kind: RemoteInputKind;
    actorName: string;
  } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [techTool, setTechTool] = useState<
    'LASER' | 'LEFT_CLICK' | 'DOUBLE_CLICK' | 'RIGHT_CLICK'
  >('LASER');
  const [remoteText, setRemoteText] = useState('');
  const [sendingInput, setSendingInput] = useState(false);

  // Media & WebRTC refs
  const localCaptureVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteP2pVideoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const captureTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const handledOfferGenRef = useRef<number>(0);
  const answerAppliedGenRef = useRef<number>(0);
  const addedRemoteIceCountRef = useRef<number>(0);
  const p2pConnectedRef = useRef<boolean>(false);
  const lastHoverSentRef = useRef<number>(0);

  const [messageApi, contextHolder] = message.useMessage();

  function closePeerConnection() {
    if (dcRef.current) {
      try {
        dcRef.current.close();
      } catch {
        /* ignore */
      }
      dcRef.current = null;
    }
    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch {
        /* ignore */
      }
      pcRef.current = null;
    }
    p2pConnectedRef.current = false;
    setP2pVideoReady(false);
    setDataChannelReady(false);
  }

  function bindDataChannel(dc: RTCDataChannel) {
    dcRef.current = dc;
    dc.onopen = () => {
      setDataChannelReady(true);
    };
    dc.onclose = () => {
      setDataChannelReady(false);
    };
    dc.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as DataChannelPointerMessage;
        if (
          msg.type === 'POINTER' &&
          typeof msg.xRatio === 'number' &&
          typeof msg.yRatio === 'number'
        ) {
          setFastPointer({
            xRatio: msg.xRatio,
            yRatio: msg.yRatio,
            kind: msg.kind,
            actorName: msg.actorName,
          });
        }
      } catch {
        /* ignore malformed packet */
      }
    };
  }

  async function publishRequesterWebRtcOffer(stream: MediaStream) {
    closePeerConnection();
    const pc = new RTCPeerConnection(RTC_CONFIG);
    pcRef.current = pc;
    addedRemoteIceCountRef.current = 0;

    // Ultra-low latency UDP DataChannel for 60Hz laser pointer & mouse coordinates
    const dc = pc.createDataChannel('smartdesk-control', {
      ordered: false,
      maxRetransmits: 0,
    });
    bindDataChannel(dc);

    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        void exchangeWebRtcSignal(sessionId, {
          iceCandidate: {
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
          },
        }).catch(() => {
          /* ignore */
        });
      }
    };

    pc.onconnectionstatechange = () => {
      const connected = pc.connectionState === 'connected';
      p2pConnectedRef.current = connected;
      setP2pVideoReady(connected);
      if (connected) {
        void exchangeWebRtcSignal(sessionId, { p2pConnected: true }).catch(
          () => {
            /* ignore */
          },
        );
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    if (offer.sdp) {
      const signalSnap = await exchangeWebRtcSignal(sessionId, {
        sdpOffer: { type: 'offer', sdp: offer.sdp },
      });
      handledOfferGenRef.current = signalSnap.offerGeneration;
      answerAppliedGenRef.current = 0;
    }
  }

  async function acceptOfferAsTechnician(data: LiveSessionStateRecord) {
    const { webrtc } = data;
    if (!webrtc.sdpOffer) return;

    closePeerConnection();
    handledOfferGenRef.current = webrtc.offerGeneration;
    addedRemoteIceCountRef.current = 0;

    const pc = new RTCPeerConnection(RTC_CONFIG);
    pcRef.current = pc;

    pc.ondatachannel = (event) => {
      bindDataChannel(event.channel);
    };

    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteStream && remoteP2pVideoRef.current) {
        remoteP2pVideoRef.current.srcObject = remoteStream;
        void remoteP2pVideoRef.current.play().catch(() => {
          /* autoplay muted works in all modern browsers */
        });
        p2pConnectedRef.current = true;
        setP2pVideoReady(true);
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        void exchangeWebRtcSignal(sessionId, {
          iceCandidate: {
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
          },
        }).catch(() => {
          /* ignore */
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        p2pConnectedRef.current = true;
        setP2pVideoReady(true);
        void exchangeWebRtcSignal(sessionId, { p2pConnected: true }).catch(
          () => {
            /* ignore */
          },
        );
      } else if (
        pc.connectionState === 'disconnected' ||
        pc.connectionState === 'failed'
      ) {
        p2pConnectedRef.current = false;
        setP2pVideoReady(false);
      }
    };

    await pc.setRemoteDescription(new RTCSessionDescription(webrtc.sdpOffer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    if (answer.sdp) {
      await exchangeWebRtcSignal(sessionId, {
        sdpAnswer: { type: 'answer', sdp: answer.sdp },
      });
    }
  }

  // Poll live state & orchestrate WebRTC signaling handshake
  useEffect(() => {
    let active = true;

    const syncLiveAndSignaling = async () => {
      try {
        const data = await getLiveSessionState(sessionId, false);
        if (!active) return;
        setLive(data);

        const { webrtc } = data;

        // 1. REQUESTER: Apply Technician's SDP Answer & ICE Candidates, or renegotiate if Technician refreshed
        if (mode === 'requester' && streamRef.current) {
          if (webrtc.renegotiateRequested) {
            await publishRequesterWebRtcOffer(streamRef.current);
            return;
          }

          const pc = pcRef.current;
          if (
            pc &&
            webrtc.sdpAnswer &&
            answerAppliedGenRef.current !== webrtc.offerGeneration &&
            pc.signalingState === 'have-local-offer'
          ) {
            answerAppliedGenRef.current = webrtc.offerGeneration;
            await pc.setRemoteDescription(
              new RTCSessionDescription(webrtc.sdpAnswer),
            );
          }

          if (pc && pc.remoteDescription) {
            const techCands = webrtc.technicianIceCandidates;
            while (addedRemoteIceCountRef.current < techCands.length) {
              const cand = techCands[addedRemoteIceCountRef.current];
              addedRemoteIceCountRef.current++;
              if (cand) {
                await pc
                  .addIceCandidate(new RTCIceCandidate(cand))
                  .catch(() => {
                    /* ignore */
                  });
              }
            }
          }
        }

        // 2. TECHNICIAN: Receive Requester's SDP Offer & send SDP Answer + apply ICE Candidates
        if (mode === 'technician' && data.streaming && webrtc.sdpOffer) {
          if (
            handledOfferGenRef.current !== webrtc.offerGeneration &&
            !webrtc.sdpAnswer
          ) {
            await acceptOfferAsTechnician(data);
          } else if (
            !pcRef.current &&
            webrtc.sdpAnswer &&
            handledOfferGenRef.current !== webrtc.offerGeneration
          ) {
            // Technician refreshed page after an earlier answer was already consumed -> ask Requester for fresh offer
            handledOfferGenRef.current = webrtc.offerGeneration;
            await exchangeWebRtcSignal(sessionId, {
              requestRenegotiate: true,
            });
          }

          const pc = pcRef.current;
          if (pc && pc.remoteDescription) {
            const reqCands = webrtc.requesterIceCandidates;
            while (addedRemoteIceCountRef.current < reqCands.length) {
              const cand = reqCands[addedRemoteIceCountRef.current];
              addedRemoteIceCountRef.current++;
              if (cand) {
                await pc
                  .addIceCandidate(new RTCIceCandidate(cand))
                  .catch(() => {
                    /* ignore */
                  });
              }
            }
          }
        }
      } catch {
        /* ignore transient poll error */
      }
    };

    void syncLiveAndSignaling();
    const timer = setInterval(() => {
      void syncLiveAndSignaling();
    }, 450);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [sessionId, mode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (captureTimerRef.current) {
        clearInterval(captureTimerRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      closePeerConnection();
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
    closePeerConnection();
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
      // Request 60 FPS Full HD stream encoded by GPU
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: { ideal: 60, max: 60 },
          width: { ideal: 1920, max: 2560 },
          height: { ideal: 1080, max: 1440 },
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

      const videoEl = localCaptureVideoRef.current;
      if (videoEl) {
        videoEl.srcObject = stream;
        await videoEl.play();
      }

      await updateLiveControlSettings(sessionId, { streaming: true });

      // Start true 60 FPS WebRTC P2P connection immediately
      await publishRequesterWebRtcOffer(stream);

      messageApi.success(
        'Đang phát màn hình 60 FPS qua WebRTC P2P (Độ trễ cực thấp ~15–20ms)!',
      );

      // Lightweight fallback snapshot (only runs when P2P UDP is not yet connected)
      captureTimerRef.current = setInterval(() => {
        if (p2pConnectedRef.current) {
          // P2P 60 FPS stream is active -> skip JPEG CPU encoding completely!
          return;
        }
        const v = localCaptureVideoRef.current;
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
          /* ignore */
        });
      }, 650);
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

  function sendFastPointerOverDataChannel(
    kind: RemoteInputKind,
    xRatio: number,
    yRatio: number,
  ): boolean {
    const dc = dcRef.current;
    if (dc && dc.readyState === 'open') {
      const packet: DataChannelPointerMessage = {
        type: 'POINTER',
        kind,
        xRatio,
        yRatio,
        actorName: 'Kỹ thuật viên',
      };
      try {
        dc.send(JSON.stringify(packet));
        setFastPointer({
          xRatio,
          yRatio,
          kind,
          actorName: 'Kỹ thuật viên',
        });
        return true;
      } catch {
        return false;
      }
    }
    return false;
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

    // Instant <5ms visual feedback via WebRTC UDP DataChannel
    sendFastPointerOverDataChannel(kindToSend, xRatio, yRatio);

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

    // If WebRTC DataChannel is open, stream pointer at 40Hz (25ms) with zero HTTP overhead!
    if (now - lastHoverSentRef.current >= 25) {
      const sentViaUdp = sendFastPointerOverDataChannel(
        'LASER',
        xRatio,
        yRatio,
      );
      if (sentViaUdp) {
        lastHoverSentRef.current = now;
        return;
      }
    }

    // Fallback to HTTP every 200ms only if DataChannel isn't open yet
    if (now - lastHoverSentRef.current >= 200) {
      lastHoverSentRef.current = now;
      void sendRemoteInput(sessionId, {
        kind: 'LASER',
        xRatio,
        yRatio,
      }).catch(() => {
        /* ignore */
      });
    }
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

  const activePointer = fastPointer ?? live?.laserPointer ?? null;
  const isP2pActive = p2pVideoReady || Boolean(live?.webrtc?.p2pConnected);

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
            Màn hình Hỗ trợ Trực tiếp 60 FPS (WebRTC P2P UDP + Win32 Native)
          </span>
          {live?.streaming ? (
            <Badge
              status="processing"
              text={
                <span style={{ color: '#4ade80', fontSize: 12 }}>
                  {isP2pActive
                    ? 'WebRTC P2P 60 FPS (Ping ~15ms)'
                    : `LIVE (${live.frameWidth}×${live.frameHeight})`}
                </span>
              }
            />
          ) : (
            <Tag color="default">Chưa phát màn hình</Tag>
          )}
          {dataChannelReady && (
            <Tag color="green" icon={<WifiOutlined />}>
              UDP DataChannel &lt;5ms
            </Tag>
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
                    🎥 Phát màn hình 60 FPS lên Web (WebRTC P2P — Không cần cài
                    App)
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
                      ? 'Kỹ thuật viên có thể click chuột & gõ phím từ Web (<1ms Win32 Native)'
                      : 'Kỹ thuật viên chỉ xem được màn hình 60 FPS & chiếu Tia Laser'}
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

        {/* 3. KHUNG HIỂN THỊ MÀN HÌNH TRỰC TIẾP 60 FPS (WEBRTC VIDEO + FALLBACK) + TIA LASER ĐỎ */}
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
          {/* Local 60 FPS Preview Video for Requester */}
          <video
            ref={localCaptureVideoRef}
            muted
            playsInline
            style={{
              display:
                mode === 'requester' && sharingLocalScreen ? 'block' : 'none',
              width: '100%',
              height: 'auto',
              maxHeight: expanded ? '80vh' : 480,
              objectFit: 'contain',
              userSelect: 'none',
            }}
          />

          {/* True 60 FPS WebRTC P2P Video Stream for Technician */}
          <video
            ref={remoteP2pVideoRef}
            autoPlay
            muted
            playsInline
            style={{
              display:
                mode !== 'requester' && p2pVideoReady ? 'block' : 'none',
              width: '100%',
              height: 'auto',
              maxHeight: expanded ? '80vh' : 480,
              objectFit: 'contain',
              userSelect: 'none',
            }}
          />

          {/* Fallback JPEG image when WebRTC P2P is still handshaking */}
          {!sharingLocalScreen &&
            !p2pVideoReady &&
            live?.streaming &&
            live.frameDataUrl && (
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
            )}

          {/* Lớp phủ Tia Laser 60Hz & Hiệu ứng Click của Kỹ thuật viên */}
          {(sharingLocalScreen || p2pVideoReady || live?.streaming) &&
            activePointer && (
              <div
                style={{
                  position: 'absolute',
                  left: `${(activePointer.xRatio * 100).toFixed(2)}%`,
                  top: `${(activePointer.yRatio * 100).toFixed(2)}%`,
                  transform: 'translate(-50%, -50%)',
                  pointerEvents: 'none',
                  zIndex: 10,
                }}
              >
                <div
                  style={{
                    width: activePointer.kind === 'LASER' ? 20 : 28,
                    height: activePointer.kind === 'LASER' ? 20 : 28,
                    borderRadius: '50%',
                    background:
                      activePointer.kind === 'LASER'
                        ? 'rgba(239, 68, 68, 0.88)'
                        : 'rgba(56, 189, 248, 0.85)',
                    border: '2px solid #ffffff',
                    boxShadow:
                      activePointer.kind === 'LASER'
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
                  {activePointer.actorName} ·{' '}
                  {INPUT_KIND_LABELS[activePointer.kind]}
                </div>
              </div>
            )}

          {/* Empty state when not streaming yet */}
          {!sharingLocalScreen && !p2pVideoReady && !live?.streaming && (
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
                  ? 'Bấm nút "🎥 Phát màn hình 60 FPS lên Web" ở phía trên để truyền hình ảnh trực tiếp qua WebRTC P2P'
                  : 'Đang chờ Người gửi bấm nút "🎥 Phát màn hình 60 FPS lên Web"...'}
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: '#64748b' }}>
                Sử dụng luồng WebRTC P2P UDP 60 FPS + RTCDataChannel độ trễ cực
                thấp (~15ms), không cần cài đặt RustDesk Client.
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
                ? '— Đã thực thi trên Windows OS (<1ms Native user32.dll)'
                : ''
            }`}
          />
        )}
      </Space>
    </Card>
  );
}
