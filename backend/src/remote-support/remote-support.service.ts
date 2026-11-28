import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import type {
  DeviceVerificationStatus,
  Prisma,
  RemoteSessionStatus,
  TicketStatus,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CancelRemoteSessionDto,
  CompleteRemoteSessionDto,
  CreateDeviceDto,
  FlagTicketRemoteSupportDto,
  NotificationsQueryDto,
  RejectRemoteSessionDto,
  RemoteSessionsQueryDto,
  RequestRemoteSessionDto,
  UpdateDeviceDto,
} from './dto/remote-support.dto.js';

const ACTIVE_SESSION_STATUSES: RemoteSessionStatus[] = [
  'REQUESTED',
  'APPROVED',
  'IN_PROGRESS',
];

const OPEN_TICKET_STATUSES: TicketStatus[] = [
  'NEW',
  'TRIAGED',
  'ASSIGNED',
  'IN_PROGRESS',
  'WAITING_REQUESTER',
];

export interface RustdeskClientConfigSnapshot {
  idServerHost: string;
  relayServerHost: string | null;
  publicKey: string | null;
  approvalTtlMinutes: number;
  clientGuideUrl: string | null;
  enabled: boolean;
}

export interface UserDeviceSnapshot {
  id: string;
  ownerId: string;
  label: string;
  rustdeskId: string;
  osName: string | null;
  verificationStatus: DeviceVerificationStatus;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RemoteSessionSnapshot {
  id: string;
  ticketId: string;
  ticketCode: string;
  ticketTitle: string;
  deviceId: string;
  deviceLabel: string;
  rustdeskId: string | null;
  deviceOsName: string | null;
  requester: { id: string; fullName: string; email?: string };
  technician: { id: string; fullName: string; email?: string };
  status: RemoteSessionStatus;
  requestNote: string | null;
  rejectionReason: string | null;
  cancelReason: string | null;
  resultSummary: string | null;
  requestedAt: Date;
  approvedAt: Date | null;
  approvalExpiresAt: Date | null;
  rejectedAt: Date | null;
  startedAt: Date | null;
  endedAt: Date | null;
  connectUri: string | null;
  cliCommand: string | null;
}

@Injectable()
export class RemoteSupportService {
  constructor(private readonly prisma: PrismaService) {}

  async getClientConfig(): Promise<RustdeskClientConfigSnapshot> {
    const existing = await this.prisma.rustdeskServerConfig.findUnique({
      where: { singletonKey: 'PRIMARY' },
    });

    if (existing) {
      return {
        idServerHost: existing.idServerHost,
        relayServerHost: existing.relayServerHost,
        publicKey: existing.publicKey,
        approvalTtlMinutes: existing.approvalTtlMinutes,
        clientGuideUrl: existing.clientGuideUrl,
        enabled: existing.enabled,
      };
    }

    const created = await this.prisma.rustdeskServerConfig.create({
      data: {
        singletonKey: 'PRIMARY',
        idServerHost: '127.0.0.1:21116',
        relayServerHost: '127.0.0.1:21117',
        publicKey: null,
        approvalTtlMinutes: 15,
        clientGuideUrl: 'https://rustdesk.com/docs/en/client/',
        enabled: false,
      },
    });

    return {
      idServerHost: created.idServerHost,
      relayServerHost: created.relayServerHost,
      publicKey: created.publicKey,
      approvalTtlMinutes: created.approvalTtlMinutes,
      clientGuideUrl: created.clientGuideUrl,
      enabled: created.enabled,
    };
  }

  /* =========================================================================
     1. REQUESTER DEVICE MANAGEMENT
  ========================================================================= */

  async listMyDevices(user: AuthenticatedUser): Promise<UserDeviceSnapshot[]> {
    this.requireRequester(user);
    return this.prisma.userDevice.findMany({
      where: { ownerId: user.id },
      orderBy: [{ active: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createMyDevice(
    user: AuthenticatedUser,
    dto: CreateDeviceDto,
  ): Promise<UserDeviceSnapshot> {
    this.requireRequester(user);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const device = await tx.userDevice.create({
          data: {
            ownerId: user.id,
            label: dto.label,
            rustdeskId: dto.rustdeskId,
            osName: dto.osName ?? null,
            verificationStatus: 'PENDING',
            active: true,
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: 'DEVICE_REGISTERED',
            entityType: 'USER_DEVICE',
            entityId: device.id,
            afterJson: JSON.stringify({
              ownerId: device.ownerId,
              label: device.label,
              osName: device.osName,
              verificationStatus: device.verificationStatus,
              active: device.active,
            }),
          },
        });

        return device;
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          'This RustDesk ID is already registered in SmartDesk',
        );
      }
      throw error;
    }
  }

  async updateMyDevice(
    user: AuthenticatedUser,
    deviceId: string,
    dto: UpdateDeviceDto,
  ): Promise<UserDeviceSnapshot> {
    this.requireRequester(user);

    const existing = await this.prisma.userDevice.findFirst({
      where: { id: deviceId, ownerId: user.id },
    });

    if (!existing) {
      throw new NotFoundException('Device not found');
    }

    if (
      (dto.active === false ||
        (dto.rustdeskId !== undefined &&
          dto.rustdeskId !== existing.rustdeskId)) &&
      (await this.hasActiveSessionForDevice(deviceId))
    ) {
      throw new ConflictException(
        'Cannot change RustDesk ID or deactivate a device while a remote support session is active',
      );
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const updated = await tx.userDevice.update({
          where: { id: deviceId },
          data: {
            ...(dto.label !== undefined ? { label: dto.label } : {}),
            ...(dto.rustdeskId !== undefined
              ? {
                  rustdeskId: dto.rustdeskId,
                  ...(dto.rustdeskId !== existing.rustdeskId
                    ? { verificationStatus: 'PENDING' as const }
                    : {}),
                }
              : {}),
            ...(dto.osName !== undefined ? { osName: dto.osName } : {}),
            ...(dto.active !== undefined ? { active: dto.active } : {}),
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: 'DEVICE_UPDATED',
            entityType: 'USER_DEVICE',
            entityId: updated.id,
            beforeJson: JSON.stringify({
              label: existing.label,
              osName: existing.osName,
              active: existing.active,
            }),
            afterJson: JSON.stringify({
              label: updated.label,
              osName: updated.osName,
              active: updated.active,
            }),
          },
        });

        return updated;
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          'This RustDesk ID is already registered in SmartDesk',
        );
      }
      throw error;
    }
  }

  /* =========================================================================
     2. TICKET REMOTE SUPPORT FLAG & SESSION LIFECYCLE
  ========================================================================= */

  async flagTicketRemoteSupport(
    user: AuthenticatedUser,
    ticketId: string,
    dto: FlagTicketRemoteSupportDto,
  ) {
    this.requireRequester(user);

    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, requesterId: user.id },
      select: {
        id: true,
        code: true,
        status: true,
        remoteSupportRequested: true,
        preferredDeviceId: true,
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    if (!OPEN_TICKET_STATUSES.includes(ticket.status)) {
      throw new ConflictException(
        'Remote support preferences can only be updated on open tickets',
      );
    }

    let device: UserDeviceSnapshot | null = null;
    if (dto.preferredDeviceId) {
      device = await this.prisma.userDevice.findFirst({
        where: { id: dto.preferredDeviceId, ownerId: user.id },
      });
      if (!device) {
        throw new BadRequestException(
          'Preferred device does not belong to your account',
        );
      }
      if (!device.active || device.verificationStatus !== 'VERIFIED') {
        throw new ConflictException(
          'Selected device must be active and verified before requesting remote support',
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.ticket.update({
        where: { id: ticketId },
        data: {
          remoteSupportRequested: dto.remoteSupportRequested,
          preferredDeviceId: dto.remoteSupportRequested
            ? (dto.preferredDeviceId ?? null)
            : null,
        },
      });

      const content = dto.remoteSupportRequested
        ? device
          ? `Người gửi bật yêu cầu Hỗ trợ từ xa qua RustDesk · Thiết bị: ${device.label}`
          : 'Người gửi bật yêu cầu Hỗ trợ từ xa qua RustDesk'
        : 'Người gửi tắt yêu cầu Hỗ trợ từ xa qua RustDesk';

      await tx.ticketActivity.create({
        data: {
          ticketId,
          actorId: user.id,
          type: 'COMMENT',
          visibility: 'PUBLIC',
          content,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          ticketId,
          action: 'TICKET_REMOTE_SUPPORT_FLAGGED',
          entityType: 'TICKET',
          entityId: ticketId,
          beforeJson: JSON.stringify({
            remoteSupportRequested: ticket.remoteSupportRequested,
            preferredDeviceId: ticket.preferredDeviceId,
          }),
          afterJson: JSON.stringify({
            remoteSupportRequested: dto.remoteSupportRequested,
            preferredDeviceId: dto.remoteSupportRequested
              ? (dto.preferredDeviceId ?? null)
              : null,
          }),
        },
      });
    });

    return this.getTicketRemoteSupportContext(user, ticketId);
  }

  async getTicketRemoteSupportContext(
    user: AuthenticatedUser,
    ticketId: string,
    now = new Date(),
  ) {
    this.requireTicketRole(user);

    await this.expireStaleApprovedSessions(now, ticketId);

    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId },
      include: {
        preferredDevice: true,
        requester: { select: { id: true, fullName: true, email: true } },
        assignee: { select: { id: true, fullName: true, email: true } },
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    const canAccess =
      (user.roles.includes('SUPERVISOR')) ||
      (user.roles.includes('REQUESTER') && ticket.requesterId === user.id) ||
      (user.roles.includes('TECHNICIAN') && ticket.assigneeId === user.id);

    if (!canAccess) {
      throw new ForbiddenException(
        'You do not have permission to view remote support sessions for this ticket',
      );
    }

    const [requesterDevices, sessions, rustdeskConfig] = await Promise.all([
      this.prisma.userDevice.findMany({
        where: {
          ownerId: ticket.requesterId,
          ...(user.roles.includes('REQUESTER') && ticket.requesterId === user.id
            ? {}
            : { active: true, verificationStatus: 'VERIFIED' }),
        },
        orderBy: [{ active: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.remoteSupportSession.findMany({
        where: { ticketId },
        include: {
          ticket: { select: { id: true, code: true, title: true, assigneeId: true } },
          device: true,
          requester: { select: { id: true, fullName: true, email: true } },
          technician: { select: { id: true, fullName: true, email: true } },
        },
        orderBy: { requestedAt: 'desc' },
      }),
      this.getClientConfig(),
    ]);

    const isOwner = user.roles.includes('REQUESTER') && ticket.requesterId === user.id;
    const redactDevice = <T extends { rustdeskId: string }>(device: T) =>
      isOwner ? device : { ...device, rustdeskId: null };

    return {
      ticketId: ticket.id,
      ticketCode: ticket.code,
      ticketStatus: ticket.status,
      remoteSupportRequested: ticket.remoteSupportRequested,
      preferredDeviceId: ticket.preferredDeviceId,
      preferredDevice: ticket.preferredDevice
        ? redactDevice(ticket.preferredDevice)
        : null,
      requesterDevices: requesterDevices.map(redactDevice),
      sessions: sessions.map((s) => this.toSessionSnapshot(s, user)),
      rustdeskConfig,
    };
  }

  async requestSession(
    user: AuthenticatedUser,
    ticketId: string,
    dto: RequestRemoteSessionDto,
    now = new Date(),
  ): Promise<RemoteSessionSnapshot> {
    this.requireTechnician(user);

    const config = await this.getClientConfig();
    if (!config.enabled) {
      throw new ConflictException(
        'RustDesk Remote Support integration is currently disabled by Administrator',
      );
    }

    await this.expireStaleApprovedSessions(now, ticketId);

    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId },
      select: {
        id: true,
        code: true,
        title: true,
        status: true,
        requesterId: true,
        assigneeId: true,
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    if (ticket.assigneeId !== user.id) {
      throw new ForbiddenException(
        'Only the assigned Technician can request a remote support session for this ticket',
      );
    }

    if (ticket.status !== 'ASSIGNED' && ticket.status !== 'IN_PROGRESS') {
      throw new ConflictException(
        'Ticket must be ASSIGNED or IN_PROGRESS to request a remote support session',
      );
    }

    const device = await this.prisma.userDevice.findFirst({
      where: { id: dto.deviceId, ownerId: ticket.requesterId },
    });

    if (!device) {
      throw new BadRequestException(
        'Selected device does not belong to the ticket Requester',
      );
    }

    if (!device.active || device.verificationStatus !== 'VERIFIED') {
      throw new ConflictException(
        'Selected device is inactive or not verified for remote support',
      );
    }

    const activeConflict = await this.prisma.remoteSupportSession.findFirst({
      where: {
        status: { in: ACTIVE_SESSION_STATUSES },
        OR: [{ ticketId }, { deviceId: device.id }],
      },
      select: { id: true, status: true, ticketId: true, deviceId: true },
    });

    if (activeConflict) {
      throw new ConflictException(
        'An active remote support session already exists for this ticket or device',
      );
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const session = await tx.remoteSupportSession.create({
        data: {
          ticketId: ticket.id,
          deviceId: device.id,
          requesterId: ticket.requesterId,
          technicianId: user.id,
          status: 'REQUESTED',
          requestNote: dto.requestNote ?? null,
          requestedAt: now,
        },
        include: {
          ticket: { select: { id: true, code: true, title: true } },
          device: true,
          requester: { select: { id: true, fullName: true, email: true } },
          technician: { select: { id: true, fullName: true, email: true } },
        },
      });

      const noteSuffix = dto.requestNote ? ` · Ghi chú: ${dto.requestNote}` : '';
      await tx.ticketActivity.create({
        data: {
          ticketId: ticket.id,
          actorId: user.id,
          type: 'COMMENT',
          visibility: 'PUBLIC',
          content: `[RustDesk Remote Support] Kỹ thuật viên ${user.fullName} gửi yêu cầu kết nối tới thiết bị "${device.label}". Đang chờ Người gửi chấp thuận${noteSuffix}`,
          createdAt: now,
        },
      });

      await tx.notification.create({
        data: {
          userId: ticket.requesterId,
          ticketId: ticket.id,
          eventKey: `remote_session:${session.id}:requested`,
          title: `Yêu cầu hỗ trợ từ xa (${ticket.code})`,
          message: `Kỹ thuật viên ${user.fullName} đề nghị kết nối RustDesk tới thiết bị "${device.label}". Vui lòng mở Ticket để Chấp thuận hoặc Từ chối.`,
          createdAt: now,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          ticketId: ticket.id,
          action: 'REMOTE_SESSION_REQUESTED',
          entityType: 'REMOTE_SUPPORT_SESSION',
          entityId: session.id,
          reason: dto.requestNote,
          afterJson: JSON.stringify({
            status: session.status,
            ticketId: session.ticketId,
            deviceId: session.deviceId,
            requesterId: session.requesterId,
            technicianId: session.technicianId,
          }),
          createdAt: now,
        },
      });

      return session;
    }).catch((error: unknown) => {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          'An active remote support session already exists for this ticket or device',
        );
      }
      throw error;
    });

    return this.toSessionSnapshot(created, user);
  }

  async approveSession(
    user: AuthenticatedUser,
    sessionId: string,
    now = new Date(),
  ): Promise<RemoteSessionSnapshot> {
    this.requireRequester(user);

    const existing = await this.prisma.remoteSupportSession.findUnique({
      where: { id: sessionId },
      include: {
        ticket: { select: { id: true, code: true, title: true, status: true } },
        device: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Remote support session not found');
    }

    if (existing.requesterId !== user.id) {
      throw new ForbiddenException(
        'Only the ticket Requester who owns the device can approve a remote support session',
      );
    }

    if (existing.status !== 'REQUESTED') {
      throw new ConflictException(
        `Cannot approve a session in status ${existing.status}`,
      );
    }
    if (!['ASSIGNED', 'IN_PROGRESS'].includes(existing.ticket.status)) {
      throw new ConflictException('Ticket is no longer open for remote support');
    }

    if (
      !existing.device.active ||
      existing.device.verificationStatus !== 'VERIFIED'
    ) {
      throw new ConflictException(
        'Device is no longer active or verified for remote support',
      );
    }

    const config = await this.getClientConfig();
    const approvalExpiresAt = new Date(
      now.getTime() + config.approvalTtlMinutes * 60_000,
    );

    const updated = await this.prisma.$transaction(async (tx) => {
      const session = await tx.remoteSupportSession.update({
        where: { id: sessionId, status: 'REQUESTED' },
        data: {
          status: 'APPROVED',
          approvedAt: now,
          approvalExpiresAt,
        },
        include: {
          ticket: { select: { id: true, code: true, title: true } },
          device: true,
          requester: { select: { id: true, fullName: true, email: true } },
          technician: { select: { id: true, fullName: true, email: true } },
        },
      });

      await tx.ticketActivity.create({
        data: {
          ticketId: session.ticketId,
          actorId: user.id,
          type: 'COMMENT',
          visibility: 'PUBLIC',
          content: `[RustDesk Remote Support] Người gửi ${user.fullName} đã CHẤP THUẬN phiên hỗ trợ từ xa trên thiết bị "${existing.device.label}" (Hiệu lực chấp thuận ${config.approvalTtlMinutes} phút đến ${approvalExpiresAt.toLocaleTimeString('vi-VN')}).`,
          createdAt: now,
        },
      });

      await tx.notification.create({
        data: {
          userId: session.technicianId,
          ticketId: session.ticketId,
          eventKey: `remote_session:${session.id}:approved`,
          title: `Đã chấp thuận kết nối RustDesk (${session.ticket.code})`,
          message: `${user.fullName} đã chấp thuận kết nối RustDesk tới thiết bị "${existing.device.label}". Hiệu lực ${config.approvalTtlMinutes} phút.`,
          createdAt: now,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          ticketId: session.ticketId,
          action: 'REMOTE_SESSION_APPROVED',
          entityType: 'REMOTE_SUPPORT_SESSION',
          entityId: session.id,
          beforeJson: JSON.stringify({ status: 'REQUESTED' }),
          afterJson: JSON.stringify({
            status: 'APPROVED',
            approvedAt: now.toISOString(),
            approvalExpiresAt: approvalExpiresAt.toISOString(),
          }),
          createdAt: now,
        },
      });

      return session;
    }).catch((error: unknown) => this.rethrowTransitionConflict(error));

    return this.toSessionSnapshot(updated, user);
  }

  async rejectSession(
    user: AuthenticatedUser,
    sessionId: string,
    dto: RejectRemoteSessionDto,
    now = new Date(),
  ): Promise<RemoteSessionSnapshot> {
    this.requireRequester(user);

    const existing = await this.prisma.remoteSupportSession.findUnique({
      where: { id: sessionId },
      include: {
        ticket: { select: { id: true, code: true, title: true } },
        device: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Remote support session not found');
    }

    if (existing.requesterId !== user.id) {
      throw new ForbiddenException(
        'Only the ticket Requester can reject this remote support session',
      );
    }

    if (existing.status !== 'REQUESTED') {
      throw new ConflictException(
        `Cannot reject a session in status ${existing.status}`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const session = await tx.remoteSupportSession.update({
        where: { id: sessionId, status: 'REQUESTED' },
        data: {
          status: 'REJECTED',
          rejectedAt: now,
          endedAt: now,
          rejectionReason: dto.reason ?? null,
        },
        include: {
          ticket: { select: { id: true, code: true, title: true } },
          device: true,
          requester: { select: { id: true, fullName: true, email: true } },
          technician: { select: { id: true, fullName: true, email: true } },
        },
      });

      const reasonSuffix = dto.reason ? ` · Lý do: ${dto.reason}` : '';
      await tx.ticketActivity.create({
        data: {
          ticketId: session.ticketId,
          actorId: user.id,
          type: 'COMMENT',
          visibility: 'PUBLIC',
          content: `[RustDesk Remote Support] Người gửi ${user.fullName} đã TỪ CHỐI yêu cầu hỗ trợ từ xa${reasonSuffix}`,
          createdAt: now,
        },
      });

      await tx.notification.create({
        data: {
          userId: session.technicianId,
          ticketId: session.ticketId,
          eventKey: `remote_session:${session.id}:rejected`,
          title: `Từ chối kết nối RustDesk (${session.ticket.code})`,
          message: `${user.fullName} đã từ chối yêu cầu kết nối RustDesk${reasonSuffix}.`,
          createdAt: now,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          ticketId: session.ticketId,
          action: 'REMOTE_SESSION_REJECTED',
          entityType: 'REMOTE_SUPPORT_SESSION',
          entityId: session.id,
          reason: dto.reason,
          beforeJson: JSON.stringify({ status: 'REQUESTED' }),
          afterJson: JSON.stringify({
            status: 'REJECTED',
            rejectedAt: now.toISOString(),
            rejectionReason: dto.reason ?? null,
          }),
          createdAt: now,
        },
      });

      return session;
    }).catch((error: unknown) => this.rethrowTransitionConflict(error));

    return this.toSessionSnapshot(updated, user);
  }

  async startSession(
    user: AuthenticatedUser,
    sessionId: string,
    now = new Date(),
  ): Promise<RemoteSessionSnapshot> {
    this.requireTechnician(user);

    const existing = await this.prisma.remoteSupportSession.findUnique({
      where: { id: sessionId },
      include: {
        ticket: {
          select: {
            id: true,
            code: true,
            title: true,
            status: true,
            assigneeId: true,
          },
        },
        device: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Remote support session not found');
    }

    if (
      existing.technicianId !== user.id ||
      existing.ticket.assigneeId !== user.id
    ) {
      throw new ForbiddenException(
        'Only the assigned Technician who requested the session can start it',
      );
    }

    if (existing.status !== 'APPROVED') {
      throw new ConflictException(
        'Session must be explicitly APPROVED by the Requester before starting connection',
      );
    }
    if (!['ASSIGNED', 'IN_PROGRESS'].includes(existing.ticket.status)) {
      throw new ConflictException('Ticket is no longer open for remote support');
    }

    if (existing.approvalExpiresAt && existing.approvalExpiresAt <= now) {
      await this.prisma.$transaction(async (tx) => {
        await tx.remoteSupportSession.update({
          where: { id: sessionId, status: 'APPROVED' },
          data: {
            status: 'CANCELLED',
            cancelReason: 'Thời hạn chấp thuận đã hết hạn (Approval TTL expired)',
            endedAt: now,
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: user.id,
            ticketId: existing.ticketId,
            action: 'REMOTE_SESSION_EXPIRED',
            entityType: 'REMOTE_SUPPORT_SESSION',
            entityId: existing.id,
            reason: 'Approval TTL expired before session start',
            beforeJson: JSON.stringify({ status: 'APPROVED' }),
            afterJson: JSON.stringify({ status: 'CANCELLED' }),
            createdAt: now,
          },
        });
      });

      throw new ConflictException(
        'Approval window has expired. Please request a new remote support session',
      );
    }

    if (
      !existing.device.active ||
      existing.device.verificationStatus !== 'VERIFIED'
    ) {
      throw new ConflictException(
        'Target device is no longer active or verified',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const session = await tx.remoteSupportSession.update({
        where: { id: sessionId, status: 'APPROVED', approvalExpiresAt: { gt: now } },
        data: {
          status: 'IN_PROGRESS',
          startedAt: now,
        },
        include: {
          ticket: { select: { id: true, code: true, title: true, assigneeId: true } },
          device: true,
          requester: { select: { id: true, fullName: true, email: true } },
          technician: { select: { id: true, fullName: true, email: true } },
        },
      });

      await tx.ticketActivity.create({
        data: {
          ticketId: session.ticketId,
          actorId: user.id,
          type: 'COMMENT',
          visibility: 'PUBLIC',
          content: `[RustDesk Remote Support] Kỹ thuật viên ${user.fullName} xác nhận ĐANG HỖ TRỢ TỪ XA (IN_PROGRESS) trên thiết bị "${existing.device.label}".`,
          createdAt: now,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          ticketId: session.ticketId,
          action: 'REMOTE_SESSION_STARTED',
          entityType: 'REMOTE_SUPPORT_SESSION',
          entityId: session.id,
          beforeJson: JSON.stringify({ status: 'APPROVED' }),
          afterJson: JSON.stringify({
            status: 'IN_PROGRESS',
            startedAt: now.toISOString(),
          }),
          createdAt: now,
        },
      });

      return session;
    }).catch((error: unknown) => this.rethrowTransitionConflict(error));

    return this.toSessionSnapshot(updated, user);
  }

  async completeSession(
    user: AuthenticatedUser,
    sessionId: string,
    dto: CompleteRemoteSessionDto,
    now = new Date(),
  ): Promise<RemoteSessionSnapshot> {
    const existing = await this.prisma.remoteSupportSession.findUnique({
      where: { id: sessionId },
      include: {
        ticket: { select: { id: true, code: true, title: true, assigneeId: true } },
        device: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Remote support session not found');
    }

    const isOwnerTechnician =
      user.roles.includes('TECHNICIAN') &&
      existing.technicianId === user.id &&
      existing.ticket.assigneeId === user.id;
    const isOwnerRequester =
      user.roles.includes('REQUESTER') && existing.requesterId === user.id;

    if (!isOwnerTechnician && !isOwnerRequester) {
      throw new ForbiddenException(
        'Only the session Technician or Requester can complete an active remote support session',
      );
    }

    if (existing.status !== 'IN_PROGRESS') {
      throw new ConflictException(
        'Only IN_PROGRESS remote support sessions can be completed',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const session = await tx.remoteSupportSession.update({
        where: { id: sessionId, status: 'IN_PROGRESS' },
        data: {
          status: 'COMPLETED',
          endedAt: now,
          resultSummary: dto.resultSummary,
        },
        include: {
          ticket: { select: { id: true, code: true, title: true } },
          device: true,
          requester: { select: { id: true, fullName: true, email: true } },
          technician: { select: { id: true, fullName: true, email: true } },
        },
      });

      await tx.ticketActivity.create({
        data: {
          ticketId: session.ticketId,
          actorId: user.id,
          type: 'COMMENT',
          visibility: 'PUBLIC',
          content: `[RustDesk Remote Support] Hoàn tất phiên hỗ trợ từ xa trên thiết bị "${existing.device.label}" · Kết quả: ${dto.resultSummary}`,
          createdAt: now,
        },
      });

      const notifyTargetUserId = isOwnerTechnician
        ? session.requesterId
        : session.technicianId;

      await tx.notification.create({
        data: {
          userId: notifyTargetUserId,
          ticketId: session.ticketId,
          eventKey: `remote_session:${session.id}:completed`,
          title: `Hoàn tất phiên hỗ trợ từ xa (${session.ticket.code})`,
          message: `Phiên hỗ trợ RustDesk trên thiết bị "${existing.device.label}" đã kết thúc. Kết quả: ${dto.resultSummary}`,
          createdAt: now,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          ticketId: session.ticketId,
          action: 'REMOTE_SESSION_COMPLETED',
          entityType: 'REMOTE_SUPPORT_SESSION',
          entityId: session.id,
          reason: dto.resultSummary,
          beforeJson: JSON.stringify({ status: 'IN_PROGRESS' }),
          afterJson: JSON.stringify({
            status: 'COMPLETED',
            endedAt: now.toISOString(),
            resultSummary: dto.resultSummary,
          }),
          createdAt: now,
        },
      });

      return session;
    }).catch((error: unknown) => this.rethrowTransitionConflict(error));

    return this.toSessionSnapshot(updated, user);
  }

  async cancelSession(
    user: AuthenticatedUser,
    sessionId: string,
    dto: CancelRemoteSessionDto,
    now = new Date(),
  ): Promise<RemoteSessionSnapshot> {
    const existing = await this.prisma.remoteSupportSession.findUnique({
      where: { id: sessionId },
      include: {
        ticket: { select: { id: true, code: true, title: true, assigneeId: true } },
        device: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Remote support session not found');
    }

    const isOwnerRequester =
      user.roles.includes('REQUESTER') && existing.requesterId === user.id;
    const isOwnerTechnician =
      user.roles.includes('TECHNICIAN') &&
      existing.technicianId === user.id &&
      existing.ticket.assigneeId === user.id;
    const isSupervisor = user.roles.includes('SUPERVISOR');

    if (!isOwnerRequester && !isOwnerTechnician && !isSupervisor) {
      throw new ForbiddenException(
        'You do not have permission to cancel this remote support session',
      );
    }

    if (!ACTIVE_SESSION_STATUSES.includes(existing.status)) {
      throw new ConflictException(
        `Cannot cancel a session that is already ${existing.status}`,
      );
    }

    if (
      isSupervisor &&
      !isOwnerRequester &&
      !isOwnerTechnician &&
      (!dto.reason || dto.reason.trim().length < 3)
    ) {
      throw new BadRequestException(
        'Supervisor cancellation of a remote session requires a reason of at least 3 characters',
      );
    }

    const cancelReason =
      dto.reason ??
      (isOwnerRequester
        ? 'Người gửi chủ động hủy / kết thúc phiên hỗ trợ'
        : 'Kỹ thuật viên hủy yêu cầu hỗ trợ từ xa');

    const updated = await this.prisma.$transaction(async (tx) => {
      const session = await tx.remoteSupportSession.update({
        where: { id: sessionId, status: { in: ACTIVE_SESSION_STATUSES } },
        data: {
          status: 'CANCELLED',
          endedAt: now,
          cancelReason,
        },
        include: {
          ticket: { select: { id: true, code: true, title: true } },
          device: true,
          requester: { select: { id: true, fullName: true, email: true } },
          technician: { select: { id: true, fullName: true, email: true } },
        },
      });

      await tx.ticketActivity.create({
        data: {
          ticketId: session.ticketId,
          actorId: user.id,
          type: 'COMMENT',
          visibility: 'PUBLIC',
          content: `[RustDesk Remote Support] Phiên hỗ trợ từ xa đã bị HỦY bởi ${user.fullName} (Từ trạng thái ${existing.status}) · Lý do: ${cancelReason}`,
          createdAt: now,
        },
      });

      const recipients = new Set<string>([
        session.requesterId,
        session.technicianId,
      ]);
      recipients.delete(user.id);

      for (const recipientId of recipients) {
        await tx.notification.create({
          data: {
            userId: recipientId,
            ticketId: session.ticketId,
            eventKey: `remote_session:${session.id}:cancelled:${recipientId}`,
            title: `Phiên hỗ trợ từ xa đã hủy (${session.ticket.code})`,
            message: `${user.fullName} đã hủy phiên hỗ trợ RustDesk trên thiết bị "${existing.device.label}". Lý do: ${cancelReason}`,
            createdAt: now,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          ticketId: session.ticketId,
          action: 'REMOTE_SESSION_CANCELLED',
          entityType: 'REMOTE_SUPPORT_SESSION',
          entityId: session.id,
          reason: cancelReason,
          beforeJson: JSON.stringify({ status: existing.status }),
          afterJson: JSON.stringify({
            status: 'CANCELLED',
            endedAt: now.toISOString(),
            cancelReason,
          }),
          createdAt: now,
        },
      });

      return session;
    }).catch((error: unknown) => this.rethrowTransitionConflict(error));

    return this.toSessionSnapshot(updated, user);
  }

  async listSessions(
    user: AuthenticatedUser,
    query: RemoteSessionsQueryDto,
    now = new Date(),
  ) {
    this.requireTicketRole(user);

    await this.expireStaleApprovedSessions(now, query.ticketId);

    const where: Prisma.RemoteSupportSessionWhereInput = {};
    if (query.ticketId) {
      where.ticketId = query.ticketId;
    }
    if (query.status) {
      where.status = query.status;
    }

    if (!user.roles.includes('SUPERVISOR')) {
      const scopes: Prisma.RemoteSupportSessionWhereInput[] = [];
      if (user.roles.includes('REQUESTER')) {
        scopes.push({ requesterId: user.id });
      }
      if (user.roles.includes('TECHNICIAN')) {
        scopes.push({ technicianId: user.id });
      }
      if (scopes.length === 1) {
        Object.assign(where, scopes[0]);
      } else {
        where.OR = scopes;
      }
    }

    const [sessions, total] = await Promise.all([
      this.prisma.remoteSupportSession.findMany({
        where,
        include: {
          ticket: { select: { id: true, code: true, title: true, assigneeId: true } },
          device: true,
          requester: { select: { id: true, fullName: true, email: true } },
          technician: { select: { id: true, fullName: true, email: true } },
        },
        orderBy: { requestedAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.remoteSupportSession.count({ where }),
    ]);

    return {
      sessions: sessions.map((s) => this.toSessionSnapshot(s, user)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  /* =========================================================================
     3. NOTIFICATIONS FOR CURRENT USER
  ========================================================================= */

  async listMyNotifications(
    user: AuthenticatedUser,
    query: NotificationsQueryDto,
  ) {
    const where: Prisma.NotificationWhereInput = {
      userId: user.id,
      ...(query.unreadOnly ? { readAt: null } : {}),
    };

    const [notifications, unreadCount, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        include: {
          ticket: { select: { id: true, code: true, title: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.notification.count({
        where: { userId: user.id, readAt: null },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      notifications,
      unreadCount,
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async markNotificationRead(
    user: AuthenticatedUser,
    notificationId: string,
    now = new Date(),
  ) {
    const existing = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId: user.id },
    });

    if (!existing) {
      throw new NotFoundException('Notification not found');
    }

    if (existing.readAt) {
      return existing;
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: now },
    });
  }

  async markAllNotificationsRead(user: AuthenticatedUser, now = new Date()) {
    const result = await this.prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: now },
    });
    return { updatedCount: result.count };
  }

  /* =========================================================================
     INTERNAL HELPERS
  ========================================================================= */

  private async expireStaleApprovedSessions(
    now: Date,
    ticketId?: string,
  ): Promise<void> {
    const expired = await this.prisma.remoteSupportSession.findMany({
      where: {
        status: 'APPROVED',
        approvalExpiresAt: { lte: now },
        ...(ticketId ? { ticketId } : {}),
      },
      select: { id: true, ticketId: true },
    });

    for (const item of expired) {
      await this.prisma.remoteSupportSession.updateMany({
        where: { id: item.id, status: 'APPROVED' },
        data: {
          status: 'CANCELLED',
          cancelReason: 'Thời hạn chấp thuận đã hết hạn (Approval TTL expired)',
          endedAt: now,
        },
      });
    }
  }

  private async hasActiveSessionForDevice(deviceId: string): Promise<boolean> {
    const count = await this.prisma.remoteSupportSession.count({
      where: {
        deviceId,
        status: { in: ACTIVE_SESSION_STATUSES },
      },
    });
    return count > 0;
  }

  private rethrowTransitionConflict(error: unknown): never {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      throw new ConflictException('Session changed. Reload and try again');
    }
    throw error;
  }

  private toSessionSnapshot(
    session: {
      id: string;
      ticketId: string;
      deviceId: string;
      requesterId: string;
      technicianId: string;
      status: RemoteSessionStatus;
      requestNote: string | null;
      rejectionReason: string | null;
      cancelReason: string | null;
      resultSummary: string | null;
      requestedAt: Date;
      approvedAt: Date | null;
      approvalExpiresAt: Date | null;
      rejectedAt: Date | null;
      startedAt: Date | null;
      endedAt: Date | null;
      ticket: { id: string; code: string; title: string; assigneeId?: string | null };
      device: {
        id: string;
        label: string;
        rustdeskId: string;
        osName: string | null;
      };
      requester: { id: string; fullName: string; email?: string };
      technician: { id: string; fullName: string; email?: string };
    },
    viewer: AuthenticatedUser,
  ): RemoteSessionSnapshot {
    const isAssignedTechnician =
      viewer.roles.includes('TECHNICIAN') &&
      session.technicianId === viewer.id &&
      session.ticket.assigneeId === viewer.id;
    const canLaunchRustdesk =
      isAssignedTechnician &&
      (session.status === 'APPROVED' || session.status === 'IN_PROGRESS');
    const canSeeId =
      (viewer.roles.includes('REQUESTER') && session.requesterId === viewer.id) ||
      canLaunchRustdesk;

    return {
      id: session.id,
      ticketId: session.ticketId,
      ticketCode: session.ticket.code,
      ticketTitle: session.ticket.title,
      deviceId: session.deviceId,
      deviceLabel: session.device.label,
      rustdeskId: canSeeId ? session.device.rustdeskId : null,
      deviceOsName: session.device.osName,
      requester: session.requester,
      technician: session.technician,
      status: session.status,
      requestNote: session.requestNote,
      rejectionReason: session.rejectionReason,
      cancelReason: session.cancelReason,
      resultSummary: session.resultSummary,
      requestedAt: session.requestedAt,
      approvedAt: session.approvedAt,
      approvalExpiresAt: session.approvalExpiresAt,
      rejectedAt: session.rejectedAt,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      connectUri: canLaunchRustdesk
        ? `rustdesk://${session.device.rustdeskId}`
        : null,
      cliCommand: canLaunchRustdesk
        ? `rustdesk --connect ${session.device.rustdeskId}`
        : null,
    };
  }

  private requireRequester(user: AuthenticatedUser): void {
    if (!user.roles.includes('REQUESTER')) {
      throw new ForbiddenException('This action requires REQUESTER role');
    }
  }

  private requireTechnician(user: AuthenticatedUser): void {
    if (!user.roles.includes('TECHNICIAN')) {
      throw new ForbiddenException('This action requires TECHNICIAN role');
    }
  }

  private requireTicketRole(user: AuthenticatedUser): void {
    if (
      !user.roles.some((role) =>
        ['REQUESTER', 'TECHNICIAN', 'SUPERVISOR'].includes(role),
      )
    ) {
      throw new ForbiddenException(
        'Access requires REQUESTER, TECHNICIAN, or SUPERVISOR role',
      );
    }
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return Boolean(
      error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code?: string }).code === 'P2002',
    );
  }
}
