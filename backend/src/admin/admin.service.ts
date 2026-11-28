import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUser, RoleCode } from '../auth/auth.types.js';
import { AuthService } from '../auth/auth.service.js';
import { SessionService } from '../auth/session.service.js';
import {
  Prisma,
  type DeviceVerificationStatus,
  type TicketPriority,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  AdminAuditLogsQueryDto,
  AdminCategoriesQueryDto,
  AdminDevicesQueryDto,
  AdminUsersQueryDto,
  CreateAdminCategoryDto,
  CreateAdminUserDto,
  UpdateAdminCategoryDto,
  UpdateAdminDeviceDto,
  UpdateAdminUserDto,
  UpdateRustdeskConfigDto,
  UpdateSlaPolicyDto,
} from './dto/admin.dto.js';

export interface AdminUserRecord {
  id: string;
  email: string;
  fullName: string;
  active: boolean;
  roles: RoleCode[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminCategoryRecord {
  id: string;
  name: string;
  active: boolean;
  ticketCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminSlaPolicyRecord {
  id: string;
  priority: TicketPriority;
  responseMinutes: number;
  resolutionMinutes: number;
  revision: number;
  active: boolean;
  updatedAt: Date;
}

export interface AdminDeviceRecord {
  id: string;
  label: string;
  rustdeskId: string;
  osName: string | null;
  verificationStatus: DeviceVerificationStatus;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  owner: {
    id: string;
    fullName: string;
    email: string;
  };
  sessionCount: number;
}

export interface AdminRustdeskConfigRecord {
  id: string;
  singletonKey: string;
  idServerHost: string;
  relayServerHost: string;
  publicKey: string | null;
  approvalTtlMinutes: number;
  clientGuideUrl: string | null;
  enabled: boolean;
  updatedById: string | null;
  updatedAt: Date;
}

export interface AdminAuditLogRecord {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  reason: string | null;
  beforeJson: string | null;
  afterJson: string | null;
  createdAt: Date;
  actor: { id: string; fullName: string; email: string } | null;
  ticket: { id: string; code: string; title: string } | null;
}

const ROLE_DISPLAY_NAMES: Record<RoleCode, string> = {
  REQUESTER: 'Requester',
  TECHNICIAN: 'Technician',
  SUPERVISOR: 'Supervisor',
  ADMIN: 'Administrator',
};

const DEFAULT_SLA_POLICIES: ReadonlyArray<{
  priority: TicketPriority;
  responseMinutes: number;
  resolutionMinutes: number;
}> = [
  { priority: 'P1', responseMinutes: 15, resolutionMinutes: 240 },
  { priority: 'P2', responseMinutes: 60, resolutionMinutes: 480 },
  { priority: 'P3', responseMinutes: 240, resolutionMinutes: 1440 },
  { priority: 'P4', responseMinutes: 480, resolutionMinutes: 4320 },
];

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly sessionService: SessionService,
  ) {}

  async listUsers(query: AdminUsersQueryDto): Promise<AdminUserRecord[]> {
    const where: Prisma.UserWhereInput = {};

    if (query.active !== undefined) {
      where.active = query.active;
    }

    if (query.role !== undefined) {
      where.userRoles = {
        some: {
          role: {
            code: query.role,
          },
        },
      };
    }

    if (query.search) {
      where.OR = [
        { email: { contains: query.search, mode: 'insensitive' } },
        { fullName: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const users = await this.prisma.user.findMany({
      where,
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { email: 'asc' }],
    });

    return users.map((user) => this.toAdminUserRecord(user));
  }

  async createUser(
    actor: AuthenticatedUser,
    dto: CreateAdminUserDto,
  ): Promise<AdminUserRecord> {
    const passwordHash = await this.authService.hashPassword(dto.password);

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const roleIds: string[] = [];
        for (const roleCode of dto.roles) {
          const role = await tx.role.upsert({
            where: { code: roleCode },
            update: {},
            create: {
              code: roleCode,
              name: ROLE_DISPLAY_NAMES[roleCode],
            },
          });
          roleIds.push(role.id);
        }

        const user = await tx.user.create({
          data: {
            email: dto.email,
            fullName: dto.fullName,
            passwordHash,
            active: dto.active,
            userRoles: {
              create: roleIds.map((roleId) => ({ roleId })),
            },
          },
          include: {
            userRoles: {
              include: {
                role: true,
              },
            },
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: actor.id,
            action: 'USER_CREATED',
            entityType: 'USER',
            entityId: user.id,
            afterJson: JSON.stringify({
              email: user.email,
              fullName: user.fullName,
              active: user.active,
              roles: dto.roles,
            }),
          },
        });

        return user;
      });

      return this.toAdminUserRecord(created);
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          'An account with this email already exists',
        );
      }
      throw error;
    }
  }

  async updateUser(
    actor: AuthenticatedUser,
    userId: string,
    dto: UpdateAdminUserDto,
  ): Promise<AdminUserRecord> {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('User account not found');
    }

    if (actor.id === userId && dto.active === false) {
      throw new BadRequestException(
        'Cannot deactivate your own administrator account',
      );
    }

    if (
      actor.id === userId &&
      dto.roles !== undefined &&
      !dto.roles.includes('ADMIN')
    ) {
      throw new BadRequestException(
        'Cannot remove ADMIN role from your own account',
      );
    }

    const passwordHash =
      dto.password !== undefined
        ? await this.authService.hashPassword(dto.password)
        : undefined;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.roles !== undefined) {
        const roleIds: string[] = [];
        for (const roleCode of dto.roles) {
          const role = await tx.role.upsert({
            where: { code: roleCode },
            update: {},
            create: {
              code: roleCode,
              name: ROLE_DISPLAY_NAMES[roleCode],
            },
          });
          roleIds.push(role.id);
        }

        await tx.userRole.deleteMany({
          where: { userId },
        });

        for (const roleId of roleIds) {
          await tx.userRole.create({
            data: {
              userId,
              roleId,
            },
          });
        }
      }

      const user = await tx.user.update({
        where: { id: userId },
        data: {
          ...(dto.fullName !== undefined ? { fullName: dto.fullName } : {}),
          ...(dto.active !== undefined ? { active: dto.active } : {}),
          ...(passwordHash !== undefined ? { passwordHash } : {}),
        },
        include: {
          userRoles: {
            include: {
              role: true,
            },
          },
        },
      });

      const previousRoles = existing.userRoles.map((ur) => ur.role.code);
      const nextRoles = user.userRoles.map((ur) => ur.role.code);

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'USER_UPDATED',
          entityType: 'USER',
          entityId: user.id,
          beforeJson: JSON.stringify({
            fullName: existing.fullName,
            active: existing.active,
            roles: previousRoles,
          }),
          afterJson: JSON.stringify({
            fullName: user.fullName,
            active: user.active,
            roles: nextRoles,
            passwordChanged: Boolean(passwordHash),
          }),
        },
      });

      return user;
    });

    if (dto.active === false || passwordHash !== undefined) {
      await this.sessionService.revokeUserSessions(userId);
    }

    return this.toAdminUserRecord(updated);
  }

  async listCategories(
    query: AdminCategoriesQueryDto,
  ): Promise<AdminCategoryRecord[]> {
    const where: Prisma.CategoryWhereInput = {};

    if (query.active !== undefined) {
      where.active = query.active;
    }

    if (query.search) {
      where.name = {
        contains: query.search,
        mode: 'insensitive',
      };
    }

    const categories = await this.prisma.category.findMany({
      where,
      include: {
        _count: {
          select: {
            tickets: true,
          },
        },
      },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    });

    return categories.map((category) => ({
      id: category.id,
      name: category.name,
      active: category.active,
      ticketCount: category._count?.tickets ?? 0,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    }));
  }

  async createCategory(
    actor: AuthenticatedUser,
    dto: CreateAdminCategoryDto,
  ): Promise<AdminCategoryRecord> {
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const category = await tx.category.create({
          data: {
            name: dto.name,
            active: dto.active,
          },
          include: {
            _count: {
              select: {
                tickets: true,
              },
            },
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: actor.id,
            action: 'CATEGORY_CREATED',
            entityType: 'CATEGORY',
            entityId: category.id,
            afterJson: JSON.stringify({
              name: category.name,
              active: category.active,
            }),
          },
        });

        return category;
      });

      return {
        id: created.id,
        name: created.name,
        active: created.active,
        ticketCount: created._count?.tickets ?? 0,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      };
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException('A category with this name already exists');
      }
      throw error;
    }
  }

  async updateCategory(
    actor: AuthenticatedUser,
    categoryId: string,
    dto: UpdateAdminCategoryDto,
  ): Promise<AdminCategoryRecord> {
    const existing = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!existing) {
      throw new NotFoundException('Category not found');
    }

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const category = await tx.category.update({
          where: { id: categoryId },
          data: {
            ...(dto.name !== undefined ? { name: dto.name } : {}),
            ...(dto.active !== undefined ? { active: dto.active } : {}),
          },
          include: {
            _count: {
              select: {
                tickets: true,
              },
            },
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: actor.id,
            action: 'CATEGORY_UPDATED',
            entityType: 'CATEGORY',
            entityId: category.id,
            beforeJson: JSON.stringify({
              name: existing.name,
              active: existing.active,
            }),
            afterJson: JSON.stringify({
              name: category.name,
              active: category.active,
            }),
          },
        });

        return category;
      });

      return {
        id: updated.id,
        name: updated.name,
        active: updated.active,
        ticketCount: updated._count?.tickets ?? 0,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      };
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException('A category with this name already exists');
      }
      throw error;
    }
  }

  async listSlaPolicies(): Promise<AdminSlaPolicyRecord[]> {
    const existing = await this.prisma.slaPolicy.findMany({
      orderBy: { priority: 'asc' },
    });

    if (existing.length < DEFAULT_SLA_POLICIES.length) {
      for (const item of DEFAULT_SLA_POLICIES) {
        await this.prisma.slaPolicy.upsert({
          where: { priority: item.priority },
          update: {},
          create: {
            priority: item.priority,
            responseMinutes: item.responseMinutes,
            resolutionMinutes: item.resolutionMinutes,
            revision: 1,
            active: true,
          },
        });
      }
      return this.prisma.slaPolicy.findMany({
        orderBy: { priority: 'asc' },
      });
    }

    return existing;
  }

  async updateSlaPolicy(
    actor: AuthenticatedUser,
    policyId: string,
    dto: UpdateSlaPolicyDto,
  ): Promise<AdminSlaPolicyRecord> {
    const existing = await this.prisma.slaPolicy.findUnique({
      where: { id: policyId },
    });

    if (!existing) {
      throw new NotFoundException('SLA policy not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.slaPolicy.update({
        where: { id: policyId },
        data: {
          responseMinutes: dto.responseMinutes,
          resolutionMinutes: dto.resolutionMinutes,
          revision: { increment: 1 },
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'SLA_POLICY_UPDATED',
          entityType: 'SLA_POLICY',
          entityId: updated.id,
          reason: dto.reason,
          beforeJson: JSON.stringify({
            priority: existing.priority,
            responseMinutes: existing.responseMinutes,
            resolutionMinutes: existing.resolutionMinutes,
            revision: existing.revision,
          }),
          afterJson: JSON.stringify({
            priority: updated.priority,
            responseMinutes: updated.responseMinutes,
            resolutionMinutes: updated.resolutionMinutes,
            revision: updated.revision,
          }),
        },
      });

      return updated;
    });
  }

  async listDevices(query: AdminDevicesQueryDto): Promise<AdminDeviceRecord[]> {
    const where: Prisma.UserDeviceWhereInput = {};

    if (query.active !== undefined) {
      where.active = query.active;
    }

    if (query.verificationStatus !== undefined) {
      where.verificationStatus = query.verificationStatus;
    }

    if (query.search) {
      where.OR = [
        { label: { contains: query.search, mode: 'insensitive' } },
        { rustdeskId: { contains: query.search, mode: 'insensitive' } },
        {
          owner: {
            OR: [
              { fullName: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    const devices = await this.prisma.userDevice.findMany({
      where,
      include: {
        owner: { select: { id: true, fullName: true, email: true } },
        _count: { select: { remoteSessions: true } },
      },
      orderBy: [{ active: 'desc' }, { createdAt: 'desc' }],
    });

    return devices.map((d) => ({
      id: d.id,
      label: d.label,
      rustdeskId: d.rustdeskId,
      osName: d.osName,
      verificationStatus: d.verificationStatus,
      active: d.active,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      owner: d.owner,
      sessionCount: d._count?.remoteSessions ?? 0,
    }));
  }

  async updateDevice(
    actor: AuthenticatedUser,
    deviceId: string,
    dto: UpdateAdminDeviceDto,
  ): Promise<AdminDeviceRecord> {
    const existing = await this.prisma.userDevice.findUnique({
      where: { id: deviceId },
    });

    if (!existing) {
      throw new NotFoundException('Registered device not found');
    }
    if (dto.verificationStatus === 'VERIFIED') {
      if (!existing.active || dto.active === false) {
        throw new ConflictException('Inactive device cannot be verified');
      }
      if (dto.observedRustdeskId !== existing.rustdeskId) {
        throw new BadRequestException('Observed RustDesk ID does not match registered device');
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const device = await tx.userDevice.update({
        where: { id: deviceId },
        data: {
          ...(dto.label !== undefined ? { label: dto.label } : {}),
          ...(dto.active !== undefined ? { active: dto.active } : {}),
          ...(dto.verificationStatus !== undefined
            ? { verificationStatus: dto.verificationStatus }
            : {}),
        },
        include: {
          owner: { select: { id: true, fullName: true, email: true } },
          _count: { select: { remoteSessions: true } },
        },
      });

      if (
        dto.active === false ||
        (dto.verificationStatus !== undefined &&
          dto.verificationStatus !== 'VERIFIED')
      ) {
        await tx.remoteSupportSession.updateMany({
          where: {
            deviceId: device.id,
            status: { in: ['REQUESTED', 'APPROVED', 'IN_PROGRESS'] },
          },
          data: {
            status: 'CANCELLED',
            endedAt: new Date(),
            cancelReason:
              dto.reason ??
              `Administrator updated device status (active: ${device.active}, verification: ${device.verificationStatus})`,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'ADMIN_DEVICE_UPDATED',
          entityType: 'USER_DEVICE',
          entityId: device.id,
          reason: dto.reason,
          beforeJson: JSON.stringify({
            label: existing.label,
            active: existing.active,
            verificationStatus: existing.verificationStatus,
          }),
          afterJson: JSON.stringify({
            label: device.label,
            active: device.active,
            verificationStatus: device.verificationStatus,
            ...(dto.verificationStatus === 'VERIFIED'
              ? { verificationMethod: dto.verificationMethod, observedInPerson: true }
              : {}),
          }),
        },
      });

      return device;
    });

    return {
      id: updated.id,
      label: updated.label,
      rustdeskId: updated.rustdeskId,
      osName: updated.osName,
      verificationStatus: updated.verificationStatus,
      active: updated.active,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      owner: updated.owner,
      sessionCount: updated._count?.remoteSessions ?? 0,
    };
  }

  async getRustdeskConfig(): Promise<AdminRustdeskConfigRecord> {
    const existing = await this.prisma.rustdeskServerConfig.findUnique({
      where: { singletonKey: 'PRIMARY' },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.rustdeskServerConfig.create({
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
  }

  async updateRustdeskConfig(
    actor: AuthenticatedUser,
    dto: UpdateRustdeskConfigDto,
  ): Promise<AdminRustdeskConfigRecord> {
    const existing = await this.getRustdeskConfig();

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.rustdeskServerConfig.update({
        where: { singletonKey: 'PRIMARY' },
        data: {
          idServerHost: dto.idServerHost,
          ...(dto.relayServerHost !== undefined
            ? { relayServerHost: dto.relayServerHost ?? dto.idServerHost }
            : {}),
          ...(dto.publicKey !== undefined ? { publicKey: dto.publicKey } : {}),
          approvalTtlMinutes: dto.approvalTtlMinutes,
          ...(dto.clientGuideUrl !== undefined
            ? { clientGuideUrl: dto.clientGuideUrl }
            : {}),
          enabled: dto.enabled,
          updatedById: actor.id,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'RUSTDESK_CONFIG_UPDATED',
          entityType: 'RUSTDESK_SERVER_CONFIG',
          entityId: updated.id,
          reason: dto.reason,
          beforeJson: JSON.stringify({
            idServerHost: existing.idServerHost,
            relayServerHost: existing.relayServerHost,
            publicKey: existing.publicKey,
            approvalTtlMinutes: existing.approvalTtlMinutes,
            clientGuideUrl: existing.clientGuideUrl,
            enabled: existing.enabled,
          }),
          afterJson: JSON.stringify({
            idServerHost: updated.idServerHost,
            relayServerHost: updated.relayServerHost,
            publicKey: updated.publicKey,
            approvalTtlMinutes: updated.approvalTtlMinutes,
            clientGuideUrl: updated.clientGuideUrl,
            enabled: updated.enabled,
          }),
        },
      });

      return updated;
    });
  }

  async listAuditLogs(
    query: AdminAuditLogsQueryDto,
  ): Promise<AdminAuditLogRecord[]> {
    const where: Prisma.AuditLogWhereInput = {};
    if (query.entityType) {
      where.entityType = query.entityType;
    }
    if (query.action) {
      where.action = query.action;
    }

    return this.prisma.auditLog.findMany({
      where,
      include: {
        actor: { select: { id: true, fullName: true, email: true } },
        ticket: { select: { id: true, code: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit,
    });
  }

  private toAdminUserRecord(user: {
    id: string;
    email: string;
    fullName: string;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
    userRoles: { role: { code: RoleCode } }[];
  }): AdminUserRecord {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      active: user.active,
      roles: user.userRoles.map(({ role }) => role.code),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
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
