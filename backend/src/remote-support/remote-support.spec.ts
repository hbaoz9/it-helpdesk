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
  UpdateDeviceDto,
  UpdateLiveControlSettingsDto,
  VerifyDeviceDto,
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

describe('RemoteSupportService (RustDesk Consent, Verification, ID Masking, Concurrency & Audit)', () => {
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
        findUnique: vi.fn(),
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
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
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

  it('1. Self-declared device registration starts as PENDING (unverified) and resets to PENDING if rustdeskId is changed; Supervisor/Admin can verify ownership', async () => {
    const dto = CreateDeviceDto.validate({
      label: 'Laptop Phòng Kế Toán',
      rustdeskId: '123 456 789',
      osName: 'Windows 11',
    });

    expect(dto.rustdeskId).toBe('123456789');

    mockPrisma.userDevice.create.mockImplementation(async ({ data }: any) => ({
      id: DEVICE_ID,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const created = await service.createMyDevice(REQUESTER_A, dto);
    expect(created.rustdeskId).toBe('123456789');
    expect(created.verificationStatus).toBe('PENDING');

    // Technician CANNOT request a remote session on a PENDING (unverified) device
    mockPrisma.ticket.findFirst.mockResolvedValue({
      id: TICKET_ID,
      code: 'INC-2026-0001',
      title: 'Lỗi phần mềm kế toán',
      status: 'IN_PROGRESS',
      requesterId: REQUESTER_A.id,
      assigneeId: TECH_ASSIGNED.id,
    });
    mockPrisma.userDevice.findFirst.mockResolvedValue(created);

    await expect(
      service.requestSession(
        TECH_ASSIGNED,
        TICKET_ID,
        RequestRemoteSessionDto.validate({ deviceId: DEVICE_ID }),
      ),
    ).rejects.toThrow(ConflictException);

    // Requester cannot verify their own device
    await expect(
      service.verifyDevice(
        REQUESTER_A,
        DEVICE_ID,
        VerifyDeviceDto.validate({
          verificationStatus: 'VERIFIED',
          reason: 'Tự xác minh',
        }),
      ),
    ).rejects.toThrow(ForbiddenException);

    // Supervisor verifies device ownership after checking employee asset
    mockPrisma.userDevice.findUnique.mockResolvedValue(created);
    mockPrisma.userDevice.update.mockImplementation(async ({ data }: any) => ({
      ...created,
      ...data,
    }));

    const verified = await service.verifyDevice(
      SUPERVISOR_USER,
      DEVICE_ID,
      VerifyDeviceDto.validate({
        verificationStatus: 'VERIFIED',
        reason: 'Đã đối chiếu mã tài sản IT-2026-091 với nhân viên',
      }),
    );
    expect(verified.verificationStatus).toBe('VERIFIED');
    expect(verified.rustdeskId).toBe('******789');

    // If Requester later changes rustdeskId on a VERIFIED device, it automatically resets to PENDING
    mockPrisma.userDevice.findFirst.mockResolvedValue({
      ...created,
      verificationStatus: 'VERIFIED',
    });
    mockPrisma.userDevice.update.mockImplementation(async ({ data }: any) => ({
      ...created,
      ...data,
    }));

    const afterIdChange = await service.updateMyDevice(
      REQUESTER_A,
      DEVICE_ID,
      UpdateDeviceDto.validate({ rustdeskId: '999888777' }),
    );
    expect(afterIdChange.verificationStatus).toBe('PENDING');
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

  it('returns a previously verified device to PENDING when its RustDesk ID changes', async () => {
    mockPrisma.userDevice.findFirst.mockResolvedValue({
      id: DEVICE_ID, ownerId: REQUESTER_A.id, label: 'Laptop',
      rustdeskId: '123456789', verificationStatus: 'VERIFIED', active: true,
    });
    mockPrisma.userDevice.update.mockResolvedValue({
      id: DEVICE_ID, ownerId: REQUESTER_A.id, label: 'Laptop',
      rustdeskId: '987654321', verificationStatus: 'PENDING', active: true,
    });
    await service.updateMyDevice(REQUESTER_A, DEVICE_ID, { rustdeskId: '987654321' });
    expect(mockPrisma.userDevice.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ rustdeskId: '987654321', verificationStatus: 'PENDING' }),
    }));
  });

  it('hides connection IDs from supervisors and technicians before requester consent', async () => {
    const device = { id: DEVICE_ID, ownerId: REQUESTER_A.id, label: 'Laptop', rustdeskId: '123456789', osName: 'Windows', active: true, verificationStatus: 'VERIFIED' };
    const ticket = { id: TICKET_ID, code: 'INC-1', title: 'Network', status: 'ASSIGNED', requesterId: REQUESTER_A.id, assigneeId: TECH_ASSIGNED.id, preferredDeviceId: DEVICE_ID, preferredDevice: device, remoteSupportRequested: true };
    const session = { id: SESSION_ID, ticketId: TICKET_ID, deviceId: DEVICE_ID, requesterId: REQUESTER_A.id, technicianId: TECH_ASSIGNED.id, status: 'REQUESTED', requestNote: null, rejectionReason: null, cancelReason: null, resultSummary: null, requestedAt: new Date(), approvedAt: null, approvalExpiresAt: null, rejectedAt: null, startedAt: null, endedAt: null, ticket, device, requester: REQUESTER_A, technician: TECH_ASSIGNED };
    mockPrisma.ticket.findFirst.mockResolvedValue(ticket);
    mockPrisma.userDevice.findMany.mockResolvedValue([device]);
    mockPrisma.remoteSupportSession.findMany.mockImplementation(({ where }: { where: { status?: string } }) => Promise.resolve(where.status === 'APPROVED' ? [] : [session]));

    for (const viewer of [TECH_ASSIGNED, SUPERVISOR_USER]) {
      const context = await service.getTicketRemoteSupportContext(viewer, TICKET_ID);
      expect(context.preferredDevice?.rustdeskId).toBeNull();
      expect(context.requesterDevices[0].rustdeskId).toBeNull();
      expect(context.sessions[0].rustdeskId).toBeNull();
      expect(JSON.stringify(context)).not.toContain('123456789');
    }
    const ownerContext = await service.getTicketRemoteSupportContext(REQUESTER_A, TICKET_ID);
    expect(ownerContext.sessions[0].rustdeskId).toBe('123456789');
  });

  it('turns a concurrent active-session unique violation into a 409', async () => {
    mockPrisma.ticket.findFirst.mockResolvedValue({
      id: TICKET_ID, code: 'INC-1', title: 'Network', status: 'ASSIGNED',
      requesterId: REQUESTER_A.id, assigneeId: TECH_ASSIGNED.id,
    });
    mockPrisma.userDevice.findFirst.mockResolvedValue({
      id: DEVICE_ID, ownerId: REQUESTER_A.id, active: true,
      verificationStatus: 'VERIFIED',
    });
    mockPrisma.remoteSupportSession.findFirst.mockResolvedValue(null);
    mockPrisma.remoteSupportSession.create.mockRejectedValue({ code: 'P2002' });
    await expect(service.requestSession(
      TECH_ASSIGNED, TICKET_ID,
      RequestRemoteSessionDto.validate({ deviceId: DEVICE_ID }),
    )).rejects.toThrow(ConflictException);
    expect(mockPrisma.ticketActivity.create).not.toHaveBeenCalled();
  });

  it('rejects a stale approval transition without writing approval activity', async () => {
    mockPrisma.remoteSupportSession.findUnique.mockResolvedValue({
      id: SESSION_ID, requesterId: REQUESTER_A.id, status: 'REQUESTED',
      ticket: { id: TICKET_ID, status: 'ASSIGNED' },
      device: { active: true, verificationStatus: 'VERIFIED' },
    });
    mockPrisma.remoteSupportSession.update.mockRejectedValue({ code: 'P2025' });
    await expect(service.approveSession(REQUESTER_A, SESSION_ID)).rejects.toThrow(ConflictException);
    expect(mockPrisma.ticketActivity.create).not.toHaveBeenCalled();
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

  it('4. Consent Gate & ID Masking: Masks rustdeskId in session snapshot, context, TicketActivity, and Notification before APPROVED, and blocks startSession while REQUESTED', async () => {
    const verifiedDevice = {
      id: DEVICE_ID,
      ownerId: REQUESTER_A.id,
      label: 'Laptop Requester A',
      rustdeskId: '102938475',
      osName: 'Windows 11',
      verificationStatus: 'VERIFIED',
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockPrisma.ticket.findFirst.mockResolvedValue({
      id: TICKET_ID,
      code: 'INC-2026-0001',
      title: 'Lỗi VPN',
      status: 'IN_PROGRESS',
      requesterId: REQUESTER_A.id,
      assigneeId: TECH_ASSIGNED.id,
      remoteSupportRequested: true,
      preferredDeviceId: DEVICE_ID,
      preferredDevice: verifiedDevice,
      requester: { id: REQUESTER_A.id, fullName: REQUESTER_A.fullName },
      assignee: { id: TECH_ASSIGNED.id, fullName: TECH_ASSIGNED.fullName },
    });

    mockPrisma.userDevice.findFirst.mockResolvedValue(verifiedDevice);
    mockPrisma.userDevice.findMany.mockResolvedValue([verifiedDevice]);
    mockPrisma.remoteSupportSession.findFirst.mockResolvedValue(null);

    const requestedSessionRow = {
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
      device: verifiedDevice,
      requester: { id: REQUESTER_A.id, fullName: REQUESTER_A.fullName },
      technician: { id: TECH_ASSIGNED.id, fullName: TECH_ASSIGNED.fullName },
    };

    mockPrisma.remoteSupportSession.create.mockResolvedValue(
      requestedSessionRow,
    );
    mockPrisma.remoteSupportSession.findMany.mockResolvedValue([
      requestedSessionRow,
    ]);

    const requested = await service.requestSession(
      TECH_ASSIGNED,
      TICKET_ID,
      RequestRemoteSessionDto.validate({
        deviceId: DEVICE_ID,
        requestNote: 'Xin phép kết nối kiểm tra VPN',
      }),
    );

    // Raw RustDesk ID and connectUri MUST be redacted (null) for Technician while REQUESTED
    expect(requested.status).toBe('REQUESTED');
    expect(requested.rustdeskId).toBeNull();
    expect(requested.connectUri).toBeNull();

    // TicketActivity and Notification MUST NOT contain raw '102938475'
    const activityArg = mockPrisma.ticketActivity.create.mock.calls[0][0];
    expect(activityArg.data.content).not.toContain('102938475');

    const notifArg = mockPrisma.notification.create.mock.calls[0][0];
    expect(notifArg.data.message).not.toContain('102938475');

    // getTicketRemoteSupportContext for Technician also redacts preferredDevice and requesterDevices while REQUESTED
    const techCtx = await service.getTicketRemoteSupportContext(
      TECH_ASSIGNED,
      TICKET_ID,
    );
    expect(techCtx.preferredDevice?.rustdeskId).toBeNull();
    expect(techCtx.requesterDevices[0]?.rustdeskId).toBeNull();
    expect(techCtx.sessions[0]?.rustdeskId).toBeNull();

    // Technician tries to start session while still REQUESTED -> ConflictException
    mockPrisma.remoteSupportSession.findUnique.mockResolvedValue({
      ...requestedSessionRow,
      ticket: {
        id: TICKET_ID,
        code: 'INC-2026-0001',
        title: 'Lỗi VPN',
        status: 'IN_PROGRESS',
        assigneeId: TECH_ASSIGNED.id,
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

  it('6. Full lifecycle: REQUESTED -> APPROVED -> IN_PROGRESS -> COMPLETED unmasks ID only during APPROVED/IN_PROGRESS and re-masks after COMPLETED', async () => {
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

    // Step B: Technician starts session within TTL window -> unmasked ID & connectUri unlocked
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
      ticket: { id: TICKET_ID, code: 'INC-2026-0001', title: 'Lỗi VPN', assigneeId: TECH_ASSIGNED.id },
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
    expect(started.rustdeskId).toBe('102938475');
    expect(started.connectUri).toBe('rustdesk://102938475');
    expect(started.cliCommand).toBe('rustdesk --connect 102938475');

    // Step C: Technician completes session -> ID and URI are re-masked/locked
    mockPrisma.remoteSupportSession.findUnique.mockResolvedValueOnce({
      id: SESSION_ID,
      ticketId: TICKET_ID,
      deviceId: DEVICE_ID,
      requesterId: REQUESTER_A.id,
      technicianId: TECH_ASSIGNED.id,
      status: 'IN_PROGRESS',
      ticket: { id: TICKET_ID, code: 'INC-2026-0001', title: 'Lỗi VPN', assigneeId: TECH_ASSIGNED.id },
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
    expect(completed.rustdeskId).toBeNull();
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
        where: { id: SESSION_ID, status: 'APPROVED' },
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

    const liveSettings = await service.updateLiveControlSettings(
      REQUESTER_A,
      SESSION_ID,
      UpdateLiveControlSettingsDto.validate({
        remoteControlEnabled: true,
        executeOnHostOs: false,
      }),
    );
    expect(liveSettings.remoteControlEnabled).toBe(true);

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

    await expect(
      service.exchangeWebRtcSignal(
        TECH_ASSIGNED,
        SESSION_ID,
        WebRtcSignalDto.validate({
          sdpOffer: { type: 'offer', sdp: 'v=0...offer' },
        }),
      ),
    ).rejects.toThrow(ForbiddenException);

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

  it('11. Concurrency Regression: handles racing requestSession (DB partial unique constraint P2002) and racing approve/start/cancel transitions (conditional updateMany count=0) without duplicate side-effects', async () => {
    // Case A: Two requestSession calls race past findFirst; the second hits PostgreSQL partial unique index (P2002)
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
      verificationStatus: 'VERIFIED',
      active: true,
    });
    mockPrisma.remoteSupportSession.findFirst.mockResolvedValue(null);
    mockPrisma.remoteSupportSession.create.mockRejectedValueOnce({
      code: 'P2002',
    });

    await expect(
      service.requestSession(
        TECH_ASSIGNED,
        TICKET_ID,
        RequestRemoteSessionDto.validate({ deviceId: DEVICE_ID }),
      ),
    ).rejects.toThrow(ConflictException);

    // Case B: Two concurrent approveSession or rejectSession calls race; the loser gets updateMany({ count: 0 })
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
    mockPrisma.remoteSupportSession.updateMany.mockResolvedValueOnce({
      count: 0,
    });

    await expect(
      service.approveSession(REQUESTER_A, SESSION_ID),
    ).rejects.toThrow(ConflictException);

    // Must abort before writing any duplicate TicketActivity, Notification, or AuditLog
    expect(mockPrisma.ticketActivity.create).not.toHaveBeenCalled();
    expect(mockPrisma.notification.create).not.toHaveBeenCalled();
    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
  });
});
