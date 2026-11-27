import {
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import {
  CancelRemoteSessionDto,
  CompleteRemoteSessionDto,
  CreateDeviceDto,
  PushLiveFrameDto,
  RejectRemoteSessionDto,
  RequestRemoteSessionDto,
  SendRemoteInputDto,
  UpdateLiveControlSettingsDto,
  WebRtcSignalDto,
} from './dto/remote-support.dto.js';
import { RemoteSupportService } from './remote-support.service.js';

const REQUESTER_A: AuthenticatedUser = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'requester.a@helpdesk.local',
  fullName: 'Requester A',
  roles: ['REQUESTER'],
  sessionId: 'sess-req-a',
};

const REQUESTER_B: AuthenticatedUser = {
  id: '22222222-2222-4222-8222-222222222222',
  email: 'requester.b@helpdesk.local',
  fullName: 'Requester B',
  roles: ['REQUESTER'],
  sessionId: 'sess-req-b',
};

const TECH_ASSIGNED: AuthenticatedUser = {
  id: '33333333-3333-4333-8333-333333333333',
  email: 'tech.assigned@helpdesk.local',
  fullName: 'Technician Assigned',
  roles: ['TECHNICIAN'],
  sessionId: 'sess-tech-1',
};

const TECH_UNASSIGNED: AuthenticatedUser = {
  id: '44444444-4444-4444-8444-444444444444',
  email: 'tech.other@helpdesk.local',
  fullName: 'Technician Other',
  roles: ['TECHNICIAN'],
  sessionId: 'sess-tech-2',
};

const SUPERVISOR_USER: AuthenticatedUser = {
  id: '55555555-5555-4555-8555-555555555555',
  email: 'supervisor@helpdesk.local',
  fullName: 'Supervisor User',
  roles: ['SUPERVISOR'],
  sessionId: 'sess-sup',
};

const ADMIN_USER: AuthenticatedUser = {
  id: '66666666-6666-4666-8666-666666666666',
  email: 'admin@helpdesk.local',
  fullName: 'Admin User',
  roles: ['ADMIN'],
  sessionId: 'sess-adm',
};

const TICKET_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const DEVICE_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const SESSION_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

describe('RemoteSupportService (RustDesk Consent, RBAC & Audit)', () => {
  let service: RemoteSupportService;
  let mockPrisma: Record<string, any>;

  beforeEach(() => {
    mockPrisma = {
      rustdeskServerConfig: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'cfg-1',
          singletonKey: 'PRIMARY',
          idServerHost: '127.0.0.1:21116',
          relayServerHost: '127.0.0.1:21117',
          publicKey: 'PUB_KEY_DEMO',
          approvalTtlMinutes: 15,
          clientGuideUrl: 'https://rustdesk.com/docs/en/client/',
          enabled: true,
        }),
        create: vi.fn(),
      },
      userDevice: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      ticket: {
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      remoteSupportSession: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        count: vi.fn().mockResolvedValue(0),
      },
      ticketActivity: {
        create: vi.fn(),
      },
      notification: {
        create: vi.fn(),
        findMany: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        count: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
      $transaction: vi.fn(async (cb: (tx: any) => Promise<any>) =>
        cb(mockPrisma),
      ),
    };

    service = new RemoteSupportService(mockPrisma as unknown as PrismaService);
  });

  it('1. Requester registers a valid RustDesk device and writes an AuditLog', async () => {
    const dto = CreateDeviceDto.validate({
      label: 'Laptop Phòng Kế Toán',
      rustdeskId: '123 456 789',
      osName: 'Windows 11',
    });

    expect(dto.rustdeskId).toBe('123456789');

    mockPrisma.userDevice.create.mockResolvedValue({
      id: DEVICE_ID,
      ownerId: REQUESTER_A.id,
      label: dto.label,
      rustdeskId: dto.rustdeskId,
      osName: dto.osName,
      verificationStatus: 'VERIFIED',
      active: true,
      lastUsedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const created = await service.createMyDevice(REQUESTER_A, dto);
    expect(created.rustdeskId).toBe('123456789');
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorId: REQUESTER_A.id,
          action: 'DEVICE_REGISTERED',
          entityType: 'USER_DEVICE',
          entityId: DEVICE_ID,
        }),
      }),
    );
  });

  it('2. Rejects duplicate RustDesk ID with 409 ConflictException', async () => {
    const dto = CreateDeviceDto.validate({
      label: 'PC Trùng ID',
      rustdeskId: '102938475',
    });

    mockPrisma.userDevice.create.mockRejectedValue({ code: 'P2002' });

    await expect(service.createMyDevice(REQUESTER_A, dto)).rejects.toThrow(
      ConflictException,
    );
  });

  it('3. Blocks unassigned Technician from requesting Remote Support on a ticket', async () => {
    mockPrisma.ticket.findFirst.mockResolvedValue({
      id: TICKET_ID,
      code: 'INC-2026-0001',
      title: 'Lỗi phần mềm kế toán',
      status: 'IN_PROGRESS',
      requesterId: REQUESTER_A.id,
      assigneeId: TECH_ASSIGNED.id,
    });

    const dto = RequestRemoteSessionDto.validate({
      deviceId: DEVICE_ID,
      requestNote: 'Kiểm tra cấu hình máy in',
    });

    await expect(
      service.requestSession(TECH_UNASSIGNED, TICKET_ID, dto),
    ).rejects.toThrow(ForbiddenException);
  });

  it('4. Consent Gate: Blocks Technician from starting session (IN_PROGRESS) before Requester approves, and hides connectUri while REQUESTED', async () => {
    mockPrisma.ticket.findFirst.mockResolvedValue({
      id: TICKET_ID,
      code: 'INC-2026-0001',
      title: 'Lỗi VPN',
      status: 'IN_PROGRESS',
      requesterId: REQUESTER_A.id,
      assigneeId: TECH_ASSIGNED.id,
    });

    mockPrisma.userDevice.findFirst.mockResolvedValue({
      id: DEVICE_ID,
      ownerId: REQUESTER_A.id,
      label: 'Laptop Requester A',
      rustdeskId: '102938475',
      osName: 'Windows 11',
      verificationStatus: 'VERIFIED',
      active: true,
    });

    mockPrisma.remoteSupportSession.findFirst.mockResolvedValue(null);
    mockPrisma.remoteSupportSession.create.mockResolvedValue({
      id: SESSION_ID,
      ticketId: TICKET_ID,
      deviceId: DEVICE_ID,
      requesterId: REQUESTER_A.id,
      technicianId: TECH_ASSIGNED.id,
      status: 'REQUESTED',
      requestNote: 'Xin phép kết nối kiểm tra VPN',
      rejectionReason: null,
      cancelReason: null,
      resultSummary: null,
      requestedAt: new Date(),
      approvedAt: null,
      approvalExpiresAt: null,
      rejectedAt: null,
      startedAt: null,
      endedAt: null,
      ticket: { id: TICKET_ID, code: 'INC-2026-0001', title: 'Lỗi VPN' },
      device: {
        id: DEVICE_ID,
        label: 'Laptop Requester A',
        rustdeskId: '102938475',
        osName: 'Windows 11',
      },
      requester: { id: REQUESTER_A.id, fullName: REQUESTER_A.fullName },
      technician: { id: TECH_ASSIGNED.id, fullName: TECH_ASSIGNED.fullName },
    });

    const requested = await service.requestSession(
      TECH_ASSIGNED,
      TICKET_ID,
      RequestRemoteSessionDto.validate({
        deviceId: DEVICE_ID,
        requestNote: 'Xin phép kết nối kiểm tra VPN',
      }),
    );

    // Connect URI must NOT be exposed before approval
    expect(requested.status).toBe('REQUESTED');
    expect(requested.connectUri).toBeNull();
    expect(mockPrisma.notification.create).toHaveBeenCalledTimes(1);

    // Technician tries to start session while still REQUESTED -> ConflictException
    mockPrisma.remoteSupportSession.findUnique.mockResolvedValue({
      id: SESSION_ID,
      ticketId: TICKET_ID,
      deviceId: DEVICE_ID,
      requesterId: REQUESTER_A.id,
      technicianId: TECH_ASSIGNED.id,
      status: 'REQUESTED',
      ticket: {
        id: TICKET_ID,
        code: 'INC-2026-0001',
        title: 'Lỗi VPN',
        status: 'IN_PROGRESS',
        assigneeId: TECH_ASSIGNED.id,
      },
      device: {
        id: DEVICE_ID,
        label: 'Laptop Requester A',
        rustdeskId: '102938475',
        active: true,
        verificationStatus: 'VERIFIED',
      },
    });

    await expect(
      service.startSession(TECH_ASSIGNED, SESSION_ID),
    ).rejects.toThrow(ConflictException);
  });

  it('5. Strictly blocks Supervisor, Admin, or another Requester (IDOR) from approving a session on behalf of the device owner', async () => {
    mockPrisma.remoteSupportSession.findUnique.mockResolvedValue({
      id: SESSION_ID,
      ticketId: TICKET_ID,
      deviceId: DEVICE_ID,
      requesterId: REQUESTER_A.id,
      technicianId: TECH_ASSIGNED.id,
      status: 'REQUESTED',
      ticket: {
        id: TICKET_ID,
        code: 'INC-2026-0001',
        title: 'Lỗi VPN',
        status: 'IN_PROGRESS',
      },
      device: {
        id: DEVICE_ID,
        label: 'Laptop Requester A',
        rustdeskId: '102938475',
        active: true,
        verificationStatus: 'VERIFIED',
      },
    });

    await expect(
      service.approveSession(SUPERVISOR_USER, SESSION_ID),
    ).rejects.toThrow(ForbiddenException);

    await expect(
      service.approveSession(ADMIN_USER, SESSION_ID),
    ).rejects.toThrow(ForbiddenException);

    await expect(
      service.approveSession(REQUESTER_B, SESSION_ID),
    ).rejects.toThrow(ForbiddenException);
  });

  it('6. Full lifecycle: REQUESTED -> APPROVED -> IN_PROGRESS -> COMPLETED with connectUri unlocked and AuditLog/TicketActivity recorded', async () => {
    const now = new Date('2026-11-24T12:00:00Z');
    const expiresAt = new Date('2026-11-24T12:15:00Z');

    // Step A: Requester A approves
    mockPrisma.remoteSupportSession.findUnique.mockResolvedValueOnce({
      id: SESSION_ID,
      ticketId: TICKET_ID,
      deviceId: DEVICE_ID,
      requesterId: REQUESTER_A.id,
      technicianId: TECH_ASSIGNED.id,
      status: 'REQUESTED',
      ticket: {
        id: TICKET_ID,
        code: 'INC-2026-0001',
        title: 'Lỗi VPN',
        status: 'IN_PROGRESS',
      },
      device: {
        id: DEVICE_ID,
        label: 'Laptop Requester A',
        rustdeskId: '102938475',
        active: true,
        verificationStatus: 'VERIFIED',
      },
    });

    mockPrisma.remoteSupportSession.update.mockResolvedValueOnce({
      id: SESSION_ID,
      ticketId: TICKET_ID,
      deviceId: DEVICE_ID,
      requesterId: REQUESTER_A.id,
      technicianId: TECH_ASSIGNED.id,
      status: 'APPROVED',
      requestNote: null,
      rejectionReason: null,
      cancelReason: null,
      resultSummary: null,
      requestedAt: now,
      approvedAt: now,
      approvalExpiresAt: expiresAt,
      rejectedAt: null,
      startedAt: null,
      endedAt: null,
      ticket: { id: TICKET_ID, code: 'INC-2026-0001', title: 'Lỗi VPN' },
      device: {
        id: DEVICE_ID,
        label: 'Laptop Requester A',
        rustdeskId: '102938475',
        osName: 'Windows 11',
      },
      requester: { id: REQUESTER_A.id, fullName: REQUESTER_A.fullName },
      technician: { id: TECH_ASSIGNED.id, fullName: TECH_ASSIGNED.fullName },
    });

    const approved = await service.approveSession(REQUESTER_A, SESSION_ID, now);
    expect(approved.status).toBe('APPROVED');
    expect(approved.approvalExpiresAt).toEqual(expiresAt);

    // Step B: Technician starts session within TTL window
    mockPrisma.remoteSupportSession.findUnique.mockResolvedValueOnce({
      id: SESSION_ID,
      ticketId: TICKET_ID,
      deviceId: DEVICE_ID,
      requesterId: REQUESTER_A.id,
      technicianId: TECH_ASSIGNED.id,
      status: 'APPROVED',
      approvalExpiresAt: expiresAt,
      ticket: {
        id: TICKET_ID,
        code: 'INC-2026-0001',
        title: 'Lỗi VPN',
        status: 'IN_PROGRESS',
        assigneeId: TECH_ASSIGNED.id,
      },
      device: {
        id: DEVICE_ID,
        label: 'Laptop Requester A',
        rustdeskId: '102938475',
        active: true,
        verificationStatus: 'VERIFIED',
      },
    });

    mockPrisma.remoteSupportSession.update.mockResolvedValueOnce({
      id: SESSION_ID,
      ticketId: TICKET_ID,
      deviceId: DEVICE_ID,
      requesterId: REQUESTER_A.id,
      technicianId: TECH_ASSIGNED.id,
      status: 'IN_PROGRESS',
      requestNote: null,
      rejectionReason: null,
      cancelReason: null,
      resultSummary: null,
      requestedAt: now,
      approvedAt: now,
      approvalExpiresAt: expiresAt,
      rejectedAt: null,
      startedAt: now,
      endedAt: null,
      ticket: { id: TICKET_ID, code: 'INC-2026-0001', title: 'Lỗi VPN' },
      device: {
        id: DEVICE_ID,
        label: 'Laptop Requester A',
        rustdeskId: '102938475',
        osName: 'Windows 11',
      },
      requester: { id: REQUESTER_A.id, fullName: REQUESTER_A.fullName },
      technician: { id: TECH_ASSIGNED.id, fullName: TECH_ASSIGNED.fullName },
    });

    const started = await service.startSession(TECH_ASSIGNED, SESSION_ID, now);
    expect(started.status).toBe('IN_PROGRESS');
    expect(started.connectUri).toBe('rustdesk://102938475');
    expect(started.cliCommand).toBe('rustdesk --connect 102938475');

    // Step C: Technician completes session with resultSummary
    mockPrisma.remoteSupportSession.findUnique.mockResolvedValueOnce({
      id: SESSION_ID,
      ticketId: TICKET_ID,
      deviceId: DEVICE_ID,
      requesterId: REQUESTER_A.id,
      technicianId: TECH_ASSIGNED.id,
      status: 'IN_PROGRESS',
      ticket: { id: TICKET_ID, code: 'INC-2026-0001', title: 'Lỗi VPN' },
      device: {
        id: DEVICE_ID,
        label: 'Laptop Requester A',
        rustdeskId: '102938475',
      },
    });

    mockPrisma.remoteSupportSession.update.mockResolvedValueOnce({
      id: SESSION_ID,
      ticketId: TICKET_ID,
      deviceId: DEVICE_ID,
      requesterId: REQUESTER_A.id,
      technicianId: TECH_ASSIGNED.id,
      status: 'COMPLETED',
      requestNote: null,
      rejectionReason: null,
      cancelReason: null,
      resultSummary: 'Đã cài lại chứng chỉ FortiClient VPN và kiểm tra kết nối.',
      requestedAt: now,
      approvedAt: now,
      approvalExpiresAt: expiresAt,
      rejectedAt: null,
      startedAt: now,
      endedAt: now,
      ticket: { id: TICKET_ID, code: 'INC-2026-0001', title: 'Lỗi VPN' },
      device: {
        id: DEVICE_ID,
        label: 'Laptop Requester A',
        rustdeskId: '102938475',
        osName: 'Windows 11',
      },
      requester: { id: REQUESTER_A.id, fullName: REQUESTER_A.fullName },
      technician: { id: TECH_ASSIGNED.id, fullName: TECH_ASSIGNED.fullName },
    });

    const completed = await service.completeSession(
      TECH_ASSIGNED,
      SESSION_ID,
      CompleteRemoteSessionDto.validate({
        resultSummary:
          'Đã cài lại chứng chỉ FortiClient VPN và kiểm tra kết nối.',
      }),
      now,
    );

    expect(completed.status).toBe('COMPLETED');
    expect(completed.connectUri).toBeNull();
    expect(mockPrisma.ticketActivity.create).toHaveBeenCalledTimes(3);
    expect(mockPrisma.auditLog.create).toHaveBeenCalledTimes(3);
  });

  it('7. Rejects starting an APPROVED session after approvalExpiresAt has passed and auto-cancels it', async () => {
    const expiredAt = new Date('2026-11-24T12:15:00Z');
    const afterExpiry = new Date('2026-11-24T12:16:00Z');

    mockPrisma.remoteSupportSession.findUnique.mockResolvedValue({
      id: SESSION_ID,
      ticketId: TICKET_ID,
      deviceId: DEVICE_ID,
      requesterId: REQUESTER_A.id,
      technicianId: TECH_ASSIGNED.id,
      status: 'APPROVED',
      approvalExpiresAt: expiredAt,
      ticket: {
        id: TICKET_ID,
        code: 'INC-2026-0001',
        title: 'Lỗi VPN',
        status: 'IN_PROGRESS',
        assigneeId: TECH_ASSIGNED.id,
      },
      device: {
        id: DEVICE_ID,
        label: 'Laptop Requester A',
        rustdeskId: '102938475',
        active: true,
        verificationStatus: 'VERIFIED',
      },
    });

    await expect(
      service.startSession(TECH_ASSIGNED, SESSION_ID, afterExpiry),
    ).rejects.toThrow(ConflictException);

    expect(mockPrisma.remoteSupportSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: SESSION_ID },
        data: expect.objectContaining({ status: 'CANCELLED' }),
      }),
    );
  });

  it('8. Allows Requester to reject a REQUESTED session or Supervisor to cancel a hung IN_PROGRESS session with an audited reason', async () => {
    mockPrisma.remoteSupportSession.findUnique.mockResolvedValueOnce({
      id: SESSION_ID,
      ticketId: TICKET_ID,
      deviceId: DEVICE_ID,
      requesterId: REQUESTER_A.id,
      technicianId: TECH_ASSIGNED.id,
      status: 'REQUESTED',
      ticket: { id: TICKET_ID, code: 'INC-2026-0001', title: 'Lỗi VPN' },
      device: {
        id: DEVICE_ID,
        label: 'Laptop Requester A',
        rustdeskId: '102938475',
      },
    });

    mockPrisma.remoteSupportSession.update.mockResolvedValueOnce({
      id: SESSION_ID,
      ticketId: TICKET_ID,
      deviceId: DEVICE_ID,
      requesterId: REQUESTER_A.id,
      technicianId: TECH_ASSIGNED.id,
      status: 'REJECTED',
      requestNote: null,
      rejectionReason: 'Đang họp với khách hàng',
      cancelReason: null,
      resultSummary: null,
      requestedAt: new Date(),
      approvedAt: null,
      approvalExpiresAt: null,
      rejectedAt: new Date(),
      startedAt: null,
      endedAt: new Date(),
      ticket: { id: TICKET_ID, code: 'INC-2026-0001', title: 'Lỗi VPN' },
      device: {
        id: DEVICE_ID,
        label: 'Laptop Requester A',
        rustdeskId: '102938475',
        osName: 'Windows 11',
      },
      requester: { id: REQUESTER_A.id, fullName: REQUESTER_A.fullName },
      technician: { id: TECH_ASSIGNED.id, fullName: TECH_ASSIGNED.fullName },
    });

    const rejected = await service.rejectSession(
      REQUESTER_A,
      SESSION_ID,
      RejectRemoteSessionDto.validate({ reason: 'Đang họp với khách hàng' }),
    );
    expect(rejected.status).toBe('REJECTED');

    // Supervisor cancels hung session
    mockPrisma.remoteSupportSession.findUnique.mockResolvedValueOnce({
      id: SESSION_ID,
      ticketId: TICKET_ID,
      deviceId: DEVICE_ID,
      requesterId: REQUESTER_A.id,
      technicianId: TECH_ASSIGNED.id,
      status: 'IN_PROGRESS',
      ticket: { id: TICKET_ID, code: 'INC-2026-0001', title: 'Lỗi VPN' },
      device: {
        id: DEVICE_ID,
        label: 'Laptop Requester A',
        rustdeskId: '102938475',
      },
    });

    mockPrisma.remoteSupportSession.update.mockResolvedValueOnce({
      id: SESSION_ID,
      ticketId: TICKET_ID,
      deviceId: DEVICE_ID,
      requesterId: REQUESTER_A.id,
      technicianId: TECH_ASSIGNED.id,
      status: 'CANCELLED',
      requestNote: null,
      rejectionReason: null,
      cancelReason: 'Phiên bị treo quá 2 giờ, giải phóng thiết bị',
      resultSummary: null,
      requestedAt: new Date(),
      approvedAt: new Date(),
      approvalExpiresAt: new Date(),
      rejectedAt: null,
      startedAt: new Date(),
      endedAt: new Date(),
      ticket: { id: TICKET_ID, code: 'INC-2026-0001', title: 'Lỗi VPN' },
      device: {
        id: DEVICE_ID,
        label: 'Laptop Requester A',
        rustdeskId: '102938475',
        osName: 'Windows 11',
      },
      requester: { id: REQUESTER_A.id, fullName: REQUESTER_A.fullName },
      technician: { id: TECH_ASSIGNED.id, fullName: TECH_ASSIGNED.fullName },
    });

    const cancelled = await service.cancelSession(
      SUPERVISOR_USER,
      SESSION_ID,
      CancelRemoteSessionDto.validate({
        reason: 'Phiên bị treo quá 2 giờ, giải phóng thiết bị',
      }),
    );
    expect(cancelled.status).toBe('CANCELLED');
  });

  it('9. In-Browser Live Screen & Web Remote Control: enforces Layer-2 consent before allowing mouse/keyboard commands', async () => {
    mockPrisma.remoteSupportSession.findUnique.mockResolvedValue({
      id: SESSION_ID,
      ticketId: TICKET_ID,
      requesterId: REQUESTER_A.id,
      technicianId: TECH_ASSIGNED.id,
      status: 'IN_PROGRESS',
      approvalExpiresAt: new Date(Date.now() + 600_000),
    });

    // Requester pushes a live screen frame from browser getDisplayMedia
    const frameRes = await service.pushLiveFrame(
      REQUESTER_A,
      SESSION_ID,
      PushLiveFrameDto.validate({
        frameDataUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
        width: 1280,
        height: 720,
      }),
    );
    expect(frameRes.ok).toBe(true);

    // Technician can use Red Laser Pointer immediately while streaming
    const laserRes = await service.sendRemoteInput(
      TECH_ASSIGNED,
      SESSION_ID,
      SendRemoteInputDto.validate({
        kind: 'LASER',
        xRatio: 0.45,
        yRatio: 0.6,
      }),
    );
    expect(laserRes.event.kind).toBe('LASER');

    // Technician CANNOT send LEFT_CLICK before Requester toggles remoteControlEnabled = true
    await expect(
      service.sendRemoteInput(
        TECH_ASSIGNED,
        SESSION_ID,
        SendRemoteInputDto.validate({
          kind: 'LEFT_CLICK',
          xRatio: 0.45,
          yRatio: 0.6,
        }),
      ),
    ).rejects.toThrow(ForbiddenException);

    // Requester explicitly enables Layer-2 OS Remote Control
    const liveSettings = await service.updateLiveControlSettings(
      REQUESTER_A,
      SESSION_ID,
      UpdateLiveControlSettingsDto.validate({
        remoteControlEnabled: true,
        executeOnHostOs: false,
      }),
    );
    expect(liveSettings.remoteControlEnabled).toBe(true);
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'REMOTE_WEB_CONTROL_GRANTED',
        }),
      }),
    );

    // Now Technician CAN send LEFT_CLICK and KEY events from the Web UI
    const clickRes = await service.sendRemoteInput(
      TECH_ASSIGNED,
      SESSION_ID,
      SendRemoteInputDto.validate({
        kind: 'LEFT_CLICK',
        xRatio: 0.5,
        yRatio: 0.5,
      }),
    );
    expect(clickRes.event.kind).toBe('LEFT_CLICK');
  });

  it('10. WebRTC P2P 60 FPS Signaling: exchanges SDP Offer, SDP Answer, and ICE candidates with strict role enforcement', async () => {
    mockPrisma.remoteSupportSession.findUnique.mockResolvedValue({
      id: SESSION_ID,
      ticketId: TICKET_ID,
      requesterId: REQUESTER_A.id,
      technicianId: TECH_ASSIGNED.id,
      status: 'APPROVED',
      approvalExpiresAt: new Date(Date.now() + 600_000),
    });

    // Technician cannot publish SDP Offer (only Requester shares screen)
    await expect(
      service.exchangeWebRtcSignal(
        TECH_ASSIGNED,
        SESSION_ID,
        WebRtcSignalDto.validate({
          sdpOffer: { type: 'offer', sdp: 'v=0...offer' },
        }),
      ),
    ).rejects.toThrow(ForbiddenException);

    // Requester publishes SDP Offer
    const afterOffer = await service.exchangeWebRtcSignal(
      REQUESTER_A,
      SESSION_ID,
      WebRtcSignalDto.validate({
        sdpOffer: { type: 'offer', sdp: 'v=0...offer' },
        iceCandidate: {
          candidate: 'candidate:1 1 UDP 2122252543 127.0.0.1 54321 typ host',
          sdpMid: '0',
          sdpMLineIndex: 0,
        },
      }),
    );
    expect(afterOffer.offerGeneration).toBe(1);
    expect(afterOffer.sdpOffer?.sdp).toBe('v=0...offer');
    expect(afterOffer.requesterIceCandidates).toHaveLength(1);

    // Technician publishes SDP Answer & marks P2P connected
    const afterAnswer = await service.exchangeWebRtcSignal(
      TECH_ASSIGNED,
      SESSION_ID,
      WebRtcSignalDto.validate({
        sdpAnswer: { type: 'answer', sdp: 'v=0...answer' },
        p2pConnected: true,
      }),
    );
    expect(afterAnswer.sdpAnswer?.sdp).toBe('v=0...answer');
    expect(afterAnswer.p2pConnected).toBe(true);
  });
});
