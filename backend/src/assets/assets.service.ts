import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '../generated/prisma/client.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  AssetCategoryDto,
  AssetQueryDto,
  AssetRecordsQueryDto,
  AssetStatusDto,
  AssignAssetDto,
  CreateAssetDto,
  CreateMaintenanceDto,
  ReturnAssetDto,
  UpdateAssetCategoryDto,
  UpdateAssetDto,
  UpdateMaintenanceDto,
} from './dto/asset.dto.js';

const ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class AssetsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(user: AuthenticatedUser) {
    this.requireAnyRole(user, ['TECHNICIAN', 'SUPERVISOR', 'ADMIN']);
    const now = new Date();
    const warrantyStart = new Date(now);
    warrantyStart.setHours(0, 0, 0, 0);
    const warrantyWindowEnd = new Date(warrantyStart);
    warrantyWindowEnd.setDate(warrantyWindowEnd.getDate() + 30);
    const [
      total,
      grouped,
      activeAssignments,
      maintenanceCount,
      categoryCount,
      categories,
      poorCondition,
      damagedCondition,
      lostAssets,
      overdueMaintenance,
      expiredWarranties,
      expiringWarranties,
      warrantyItems,
    ] = await Promise.all([
      this.prisma.asset.count({ where: { deletedAt: null } }),
      this.prisma.asset.groupBy({
        by: ['status'],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
      this.prisma.assetAssignment.count({ where: { returnedAt: null } }),
      this.prisma.assetMaintenance.count({
        where: { status: { in: ['SCHEDULED', 'IN_PROGRESS'] } },
      }),
      this.prisma.assetCategory.count({ where: { active: true } }),
      this.prisma.assetCategory.findMany({
        where: { active: true },
        select: {
          id: true,
          name: true,
          _count: { select: { assets: { where: { deletedAt: null } } } },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.asset.count({
        where: { deletedAt: null, condition: 'POOR' },
      }),
      this.prisma.asset.count({
        where: { deletedAt: null, condition: 'DAMAGED' },
      }),
      this.prisma.asset.count({ where: { deletedAt: null, status: 'LOST' } }),
      this.prisma.assetMaintenance.count({
        where: {
          status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
          scheduledAt: { lt: now },
        },
      }),
      this.prisma.asset.count({
        where: { deletedAt: null, warrantyExpires: { lt: warrantyStart } },
      }),
      this.prisma.asset.count({
        where: {
          deletedAt: null,
          warrantyExpires: { gte: warrantyStart, lte: warrantyWindowEnd },
        },
      }),
      this.prisma.asset.findMany({
        where: {
          deletedAt: null,
          warrantyExpires: { gte: warrantyStart, lte: warrantyWindowEnd },
        },
        select: {
          id: true,
          assetTag: true,
          name: true,
          warrantyExpires: true,
          category: { select: { id: true, name: true } },
        },
        orderBy: { warrantyExpires: 'asc' },
        take: 10,
      }),
    ]);
    return {
      total,
      byStatus: Object.fromEntries(
        grouped.map((row) => [row.status, row._count._all]),
      ),
      activeAssignments,
      activeMaintenance: maintenanceCount,
      activeCategories: categoryCount,
      categoryCounts: categories.map((category) => ({
        id: category.id,
        name: category.name,
        count: category._count.assets,
      })),
      attention: {
        poorCondition: poorCondition,
        damagedCondition: damagedCondition,
        lostAssets,
        overdueMaintenance,
      },
      warranty: {
        expired: expiredWarranties,
        expiringWithin30Days: expiringWarranties,
        items: warrantyItems,
      },
    };
  }

  async categories(user: AuthenticatedUser) {
    const includeInactive = user.roles.includes('ADMIN');
    return this.prisma.assetCategory.findMany({
      where: includeInactive ? undefined : { active: true },
      orderBy: { name: 'asc' },
      include: includeInactive
        ? { _count: { select: { assets: true } } }
        : undefined,
    });
  }

  async createCategory(user: AuthenticatedUser, dto: AssetCategoryDto) {
    this.requireAdmin(user);
    try {
      return await this.prisma.assetCategory.create({
        data: {
          name: dto.name,
          description: dto.description,
          active: dto.active ?? true,
        },
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(
          'An asset category with this name already exists',
        );
      }
      throw error;
    }
  }

  async updateCategory(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateAssetCategoryDto,
  ) {
    this.requireAdmin(user);
    this.assertId(id);
    await this.requireCategory(id);
    try {
      return await this.prisma.assetCategory.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description }
            : {}),
          ...(dto.active !== undefined ? { active: dto.active } : {}),
        },
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(
          'An asset category with this name already exists',
        );
      }
      throw error;
    }
  }

  async deleteCategory(user: AuthenticatedUser, id: string) {
    this.requireAdmin(user);
    this.assertId(id);
    await this.requireCategory(id);
    if (await this.prisma.asset.count({ where: { categoryId: id } })) {
      throw new ConflictException(
        'Cannot delete a category that contains assets',
      );
    }
    return this.prisma.assetCategory.delete({ where: { id } });
  }

  async findAll(user: AuthenticatedUser, query: AssetQueryDto) {
    this.requireAnyRole(user, ['TECHNICIAN', 'SUPERVISOR', 'ADMIN']);
    const where: Prisma.AssetWhereInput = {
      deletedAt: null,
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { assetTag: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
              { serialNumber: { contains: query.search, mode: 'insensitive' } },
              { manufacturer: { contains: query.search, mode: 'insensitive' } },
              { model: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.asset.findMany({
        where,
        include: this.assetListInclude(),
        orderBy: [{ updatedAt: 'desc' }, { assetTag: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.asset.count({ where }),
    ]);
    return { items, total, page: query.page, limit: query.limit };
  }

  async findOne(user: AuthenticatedUser, id: string) {
    this.requireAnyRole(user, ['TECHNICIAN', 'SUPERVISOR', 'ADMIN']);
    this.assertId(id);
    const asset = await this.prisma.asset.findFirst({
      where: { id, deletedAt: null },
      include: {
        category: true,
        assignments: {
          where: { returnedAt: null },
          take: 1,
          orderBy: { assignedAt: 'desc' },
          include: {
            user: { select: { id: true, fullName: true, email: true } },
          },
        },
        _count: {
          select: { assignments: true, maintenance: true, tickets: true },
        },
      },
    });
    if (!asset) throw new NotFoundException('Asset not found');
    return asset;
  }

  async create(user: AuthenticatedUser, dto: CreateAssetDto) {
    this.requireAdmin(user);
    await this.requireActiveCategory(dto.categoryId);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const asset = await tx.asset.create({
          data: {
            assetTag:
              dto.assetTag ?? `AST-${randomUUID().slice(0, 8).toUpperCase()}`,
            name: dto.name,
            sharedReportable: dto.sharedReportable ?? false,
            categoryId: dto.categoryId,
            manufacturer: dto.manufacturer,
            model: dto.model,
            serialNumber: dto.serialNumber,
            condition: dto.condition,
            purchaseDate: dto.purchaseDate,
            purchaseCost: dto.purchaseCost,
            warrantyExpires: dto.warrantyExpires,
            location: dto.location,
            notes: dto.notes,
          },
          include: { category: true },
        });
        await tx.assetHistory.create({
          data: {
            assetId: asset.id,
            actorId: user.id,
            action: 'CREATED',
            details: { assetTag: asset.assetTag, name: asset.name },
          },
        });
        return asset;
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(
          'Asset tag or serial number is already in use',
        );
      }
      throw error;
    }
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateAssetDto) {
    this.requireAdmin(user);
    this.assertId(id);
    await this.requireAsset(id);
    if (dto.categoryId) await this.requireActiveCategory(dto.categoryId);
    const data: Prisma.AssetUncheckedUpdateInput = {
      ...(dto.assetTag !== undefined ? { assetTag: dto.assetTag } : {}),
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.sharedReportable !== undefined ? { sharedReportable: dto.sharedReportable } : {}),
      ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
      ...(dto.manufacturer !== undefined
        ? { manufacturer: dto.manufacturer }
        : {}),
      ...(dto.model !== undefined ? { model: dto.model } : {}),
      ...(dto.serialNumber !== undefined
        ? { serialNumber: dto.serialNumber }
        : {}),
      ...(dto.condition !== undefined ? { condition: dto.condition } : {}),
      ...(dto.purchaseDate !== undefined
        ? { purchaseDate: dto.purchaseDate }
        : {}),
      ...(dto.purchaseCost !== undefined
        ? { purchaseCost: dto.purchaseCost }
        : {}),
      ...(dto.warrantyExpires !== undefined
        ? { warrantyExpires: dto.warrantyExpires }
        : {}),
      ...(dto.location !== undefined ? { location: dto.location } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
    };
    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const asset = await tx.asset.update({
          where: { id },
          data,
          include: { category: true },
        });
        await tx.assetHistory.create({
          data: {
            assetId: id,
            actorId: user.id,
            action: 'UPDATED',
            details: { changedFields: Object.keys(data) },
          },
        });
        return asset;
      });
      return updated;
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(
          'Asset tag or serial number is already in use',
        );
      }
      throw error;
    }
  }

  async remove(user: AuthenticatedUser, id: string) {
    this.requireAdmin(user);
    this.assertId(id);
    await this.requireAsset(id);
    const [assignments, maintenance, tickets, meaningfulHistory] =
      await Promise.all([
        this.prisma.assetAssignment.count({ where: { assetId: id } }),
        this.prisma.assetMaintenance.count({ where: { assetId: id } }),
        this.prisma.ticket.count({ where: { assetId: id } }),
        this.prisma.assetHistory.count({
          where: { assetId: id, action: { not: 'CREATED' } },
        }),
      ]);
    if (assignments || maintenance || tickets || meaningfulHistory) {
      throw new ConflictException(
        'Asset has related records and cannot be removed',
      );
    }
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const asset = await tx.asset.findFirst({
        where: { id, deletedAt: null },
        select: { status: true },
      });
      if (!asset) throw new NotFoundException('Asset not found');
      const removed = await tx.asset.update({
        where: { id },
        data: { deletedAt: now, status: 'RETIRED' },
      });
      await tx.assetHistory.create({
        data: {
          assetId: id,
          actorId: user.id,
          action: 'DELETED',
          details: { priorStatus: asset.status },
          createdAt: now,
        },
      });
      return removed;
    });
  }

  async setStatus(user: AuthenticatedUser, id: string, dto: AssetStatusDto) {
    this.requireAdmin(user);
    this.assertId(id);
    const asset = await this.requireAsset(id);
    if (dto.status === 'ASSIGNED') {
      throw new BadRequestException(
        'Use the assignment endpoint to assign an asset',
      );
    }
    const activeAssignment = await this.prisma.assetAssignment.findFirst({
      where: { assetId: id, returnedAt: null },
      select: { id: true },
    });
    if (activeAssignment) {
      throw new ConflictException(
        'Return the assigned asset before changing its status',
      );
    }
    if (
      dto.status === 'AVAILABLE' &&
      (await this.prisma.assetMaintenance.count({
        where: { assetId: id, status: { in: ['SCHEDULED', 'IN_PROGRESS'] } },
      }))
    ) {
      throw new ConflictException(
        'Complete or cancel active maintenance before marking available',
      );
    }
    if (
      ['RETIRED', 'DISPOSED', 'LOST'].includes(dto.status) &&
      (await this.prisma.assetMaintenance.count({
        where: { assetId: id, status: { in: ['SCHEDULED', 'IN_PROGRESS'] } },
      }))
    ) {
      throw new ConflictException(
        'Complete or cancel active maintenance before retiring the asset',
      );
    }
    if (asset.status === dto.status) return asset;
    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.asset.updateMany({
        where: { id, status: asset.status, deletedAt: null },
        data: { status: dto.status },
      });
      if (changed.count !== 1) {
        throw new ConflictException('Asset status changed. Reload and try again');
      }
      await tx.assetHistory.create({
        data: {
          assetId: id,
          actorId: user.id,
          action: 'STATUS_CHANGED',
          details: { from: asset.status, to: dto.status },
        },
      });
      return tx.asset.findUnique({ where: { id } });
    });
  }

  async myAssigned(user: AuthenticatedUser) {
    this.requireRequester(user);
    return this.prisma.asset.findMany({
      where: {
        deletedAt: null,
        assignments: { some: { userId: user.id, returnedAt: null } },
      },
      include: {
        category: true,
        assignments: {
          where: { userId: user.id, returnedAt: null },
          orderBy: { assignedAt: 'desc' },
          take: 1,
          select: { id: true, assignedAt: true, notes: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async searchForTicket(user: AuthenticatedUser, query: AssetQueryDto) {
    this.requireRequester(user);
    return this.prisma.asset.findMany({
      where: {
        deletedAt: null,
        OR: [
          { assignments: { some: { userId: user.id, returnedAt: null } } },
          { sharedReportable: true, status: 'AVAILABLE' },
        ],
        ...(query.search
          ? {
              AND: [{ OR: [
                { assetTag: { contains: query.search, mode: 'insensitive' } },
                { name: { contains: query.search, mode: 'insensitive' } },
                {
                  serialNumber: { contains: query.search, mode: 'insensitive' },
                },
              ] }],
            }
          : {}),
      },
      select: {
        id: true,
        assetTag: true,
        name: true,
        category: { select: { name: true } },
        location: true,
        status: true,
      },
      orderBy: { name: 'asc' },
      take: 20,
    });
  }

  async assignments(user: AuthenticatedUser, id: string) {
    this.requireAnyRole(user, ['SUPERVISOR', 'ADMIN']);
    this.assertId(id);
    await this.requireAsset(id);
    return this.prisma.assetAssignment.findMany({
      where: { assetId: id },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        assignedBy: { select: { id: true, fullName: true } },
        returnedBy: { select: { id: true, fullName: true } },
      },
      orderBy: { assignedAt: 'desc' },
    });
  }

  async assignmentRecords(
    user: AuthenticatedUser,
    query: AssetRecordsQueryDto,
  ) {
    this.requireAnyRole(user, ['TECHNICIAN', 'SUPERVISOR', 'ADMIN']);
    const where: Prisma.AssetAssignmentWhereInput = {
      ...(query.assetId ? { assetId: query.assetId } : {}),
      ...(query.status === 'ACTIVE' ? { returnedAt: null } : {}),
      ...(query.status === 'RETURNED' ? { returnedAt: { not: null } } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            assignedAt: {
              ...(query.dateFrom ? { gte: query.dateFrom } : {}),
              ...(query.dateTo ? { lte: query.dateTo } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              {
                asset: {
                  assetTag: { contains: query.search, mode: 'insensitive' },
                },
              },
              {
                asset: {
                  name: { contains: query.search, mode: 'insensitive' },
                },
              },
              {
                user: {
                  fullName: { contains: query.search, mode: 'insensitive' },
                },
              },
              {
                user: {
                  email: { contains: query.search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.assetAssignment.findMany({
        where,
        include: {
          asset: {
            select: {
              id: true,
              assetTag: true,
              name: true,
              category: { select: { name: true } },
            },
          },
          user: { select: { id: true, fullName: true, email: true } },
          assignedBy: { select: { id: true, fullName: true } },
          returnedBy: { select: { id: true, fullName: true } },
        },
        orderBy: { assignedAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.assetAssignment.count({ where }),
    ]);
    return { items, total, page: query.page, limit: query.limit };
  }

  async assign(user: AuthenticatedUser, id: string, dto: AssignAssetDto) {
    this.requireAdmin(user);
    this.assertId(id);
    this.assertId(dto.userId);
    const recipient = await this.prisma.user.findFirst({
      where: { id: dto.userId, active: true },
      select: { id: true },
    });
    if (!recipient)
      throw new BadRequestException('Assignment user is unavailable');
    const asset = await this.requireAsset(id);
    if (asset.status !== 'AVAILABLE') {
      throw new ConflictException('Only available assets can be assigned');
    }
    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.asset.updateMany({
        where: { id, status: 'AVAILABLE', deletedAt: null },
        data: { status: 'ASSIGNED' },
      });
      if (changed.count !== 1) {
        throw new ConflictException(
          'Asset status changed. Reload and try again',
        );
      }
      const assignment = await tx.assetAssignment.create({
        data: {
          assetId: id,
          userId: dto.userId,
          assignedById: user.id,
          notes: dto.notes,
          conditionAtAssignment: dto.conditionAtAssignment,
        },
        include: {
          user: { select: { id: true, fullName: true, email: true } },
        },
      });
      await tx.assetHistory.create({
        data: {
          assetId: id,
          actorId: user.id,
          action: 'ASSIGNED',
          details: { assignmentId: assignment.id, userId: dto.userId },
        },
      });
      return assignment;
    });
  }

  async returnAsset(user: AuthenticatedUser, id: string, dto: ReturnAssetDto) {
    this.requireAdmin(user);
    this.assertId(id);
    await this.requireAsset(id);
    const assignment = await this.prisma.assetAssignment.findFirst({
      where: { assetId: id, returnedAt: null },
      orderBy: { assignedAt: 'desc' },
    });
    if (!assignment)
      throw new ConflictException('Asset has no active assignment');
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.assetAssignment.updateMany({
        where: { id: assignment.id, returnedAt: null },
        data: {
          returnedAt: now,
          returnedById: user.id,
          returnNotes: dto.notes,
          conditionAtReturn: dto.conditionAtReturn,
        },
      });
      const assetChanged = await tx.asset.updateMany({
        where: { id, status: 'ASSIGNED', deletedAt: null },
        data: { status: 'AVAILABLE' },
      });
      if (changed.count !== 1 || assetChanged.count !== 1) {
        throw new ConflictException('Assignment changed. Reload and try again');
      }
      await tx.assetHistory.create({
        data: {
          assetId: id,
          actorId: user.id,
          action: 'RETURNED',
          details: { assignmentId: assignment.id, userId: assignment.userId },
          createdAt: now,
        },
      });
      return tx.assetAssignment.findUnique({ where: { id: assignment.id } });
    });
  }

  async maintenance(user: AuthenticatedUser, id: string) {
    this.requireAnyRole(user, ['TECHNICIAN', 'SUPERVISOR', 'ADMIN']);
    this.assertId(id);
    await this.requireAsset(id);
    return this.prisma.assetMaintenance.findMany({
      where: { assetId: id },
      include: { createdBy: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async maintenanceRecords(
    user: AuthenticatedUser,
    query: AssetRecordsQueryDto,
  ) {
    this.requireAnyRole(user, ['TECHNICIAN', 'SUPERVISOR', 'ADMIN']);
    const where: Prisma.AssetMaintenanceWhereInput = {
      ...(query.assetId ? { assetId: query.assetId } : {}),
      ...(query.status &&
      query.status !== 'ACTIVE' &&
      query.status !== 'RETURNED'
        ? { status: query.status }
        : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            createdAt: {
              ...(query.dateFrom ? { gte: query.dateFrom } : {}),
              ...(query.dateTo ? { lte: query.dateTo } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { provider: { contains: query.search, mode: 'insensitive' } },
              {
                asset: {
                  assetTag: { contains: query.search, mode: 'insensitive' },
                },
              },
              {
                asset: {
                  name: { contains: query.search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.assetMaintenance.findMany({
        where,
        include: {
          asset: {
            select: {
              id: true,
              assetTag: true,
              name: true,
              category: { select: { name: true } },
            },
          },
          createdBy: { select: { id: true, fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.assetMaintenance.count({ where }),
    ]);
    return { items, total, page: query.page, limit: query.limit };
  }

  async createMaintenance(
    user: AuthenticatedUser,
    id: string,
    dto: CreateMaintenanceDto,
  ) {
    this.requireAnyRole(user, ['TECHNICIAN', 'ADMIN']);
    this.assertId(id);
    await this.requireAsset(id);
    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.asset.updateMany({
        where: { id, status: 'AVAILABLE', deletedAt: null },
        data: { status: 'UNDER_MAINTENANCE' },
      });
      if (changed.count !== 1) {
        throw new ConflictException(
          'Only available assets can be scheduled for maintenance',
        );
      }
      const maintenance = await tx.assetMaintenance.create({
        data: {
          assetId: id,
          createdById: user.id,
          title: dto.title,
          type: dto.type,
          description: dto.description,
          diagnosis: dto.diagnosis,
          resolution: dto.resolution,
          notes: dto.notes,
          provider: dto.provider,
          cost: dto.cost,
          scheduledAt: dto.scheduledAt,
        },
      });
      await tx.assetHistory.create({
        data: {
          assetId: id,
          actorId: user.id,
          action: 'MAINTENANCE_CREATED',
          details: { maintenanceId: maintenance.id, title: maintenance.title },
        },
      });
      return maintenance;
    });
  }

  async updateMaintenance(
    user: AuthenticatedUser,
    id: string,
    maintenanceId: string,
    dto: UpdateMaintenanceDto,
  ) {
    this.requireAnyRole(user, ['TECHNICIAN', 'ADMIN']);
    this.assertId(id);
    this.assertId(maintenanceId);
    const existing = await this.prisma.assetMaintenance.findFirst({
      where: { id: maintenanceId, assetId: id },
    });
    if (!existing) throw new NotFoundException('Maintenance record not found');
    if (
      ['COMPLETED', 'CANCELLED'].includes(existing.status) &&
      dto.status !== existing.status
    ) {
      throw new ConflictException(
        'Completed or cancelled maintenance cannot be reopened',
      );
    }
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.assetMaintenance.updateMany({
        where: {
          id: maintenanceId,
          assetId: id,
          status: existing.status,
          updatedAt: existing.updatedAt,
        },
        data: {
          status: dto.status,
          ...(dto.description !== undefined
            ? { description: dto.description }
            : {}),
          ...(dto.diagnosis !== undefined ? { diagnosis: dto.diagnosis } : {}),
          ...(dto.resolution !== undefined
            ? { resolution: dto.resolution }
            : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
          ...(dto.provider !== undefined ? { provider: dto.provider } : {}),
          ...(dto.cost !== undefined ? { cost: dto.cost } : {}),
          ...(dto.scheduledAt !== undefined
            ? { scheduledAt: dto.scheduledAt }
            : {}),
          ...(dto.status === 'IN_PROGRESS' && !existing.startedAt
            ? { startedAt: now }
            : {}),
          ...(dto.status === 'COMPLETED' ? { completedAt: now } : {}),
        },
      });
      if (changed.count !== 1) {
        throw new ConflictException('Maintenance changed. Reload and try again');
      }
      const hasOtherOpenRecords = await tx.assetMaintenance.count({
        where: {
          assetId: id,
          id: { not: maintenanceId },
          status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
        },
      });
      if (!['COMPLETED', 'CANCELLED'].includes(existing.status)) {
        if (dto.status === 'COMPLETED' || dto.status === 'CANCELLED') {
          if (!hasOtherOpenRecords) {
            const assetChanged = await tx.asset.updateMany({
              where: { id, status: 'UNDER_MAINTENANCE', deletedAt: null },
              data: { status: 'AVAILABLE' },
            });
            if (assetChanged.count !== 1) {
              throw new ConflictException('Asset status changed. Reload and try again');
            }
          }
        } else {
          const assetChanged = await tx.asset.updateMany({
            where: { id, status: 'UNDER_MAINTENANCE', deletedAt: null },
            data: { status: 'UNDER_MAINTENANCE' },
          });
          if (assetChanged.count !== 1) {
            throw new ConflictException('Asset status changed. Reload and try again');
          }
        }
      }
      await tx.assetHistory.create({
        data: {
          assetId: id,
          actorId: user.id,
          action: 'MAINTENANCE_UPDATED',
          details: {
            maintenanceId,
            from: existing.status,
            to: dto.status,
            updatedFields: Object.keys(dto),
          },
          createdAt: now,
        },
      });
      return tx.assetMaintenance.findUnique({ where: { id: maintenanceId } });
    });
  }

  async history(user: AuthenticatedUser, id: string) {
    this.requireAnyRole(user, ['TECHNICIAN', 'SUPERVISOR', 'ADMIN']);
    this.assertId(id);
    await this.requireAsset(id);
    return this.prisma.assetHistory.findMany({
      where: { assetId: id },
      include: { actor: { select: { id: true, fullName: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  async historyRecords(user: AuthenticatedUser, query: AssetRecordsQueryDto) {
    this.requireAnyRole(user, ['TECHNICIAN', 'SUPERVISOR', 'ADMIN']);
    const where: Prisma.AssetHistoryWhereInput = {
      ...(query.assetId ? { assetId: query.assetId } : {}),
      ...(query.type ? { action: query.type } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            createdAt: {
              ...(query.dateFrom ? { gte: query.dateFrom } : {}),
              ...(query.dateTo ? { lte: query.dateTo } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            asset: {
              OR: [
                { assetTag: { contains: query.search, mode: 'insensitive' } },
                { name: { contains: query.search, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.assetHistory.findMany({
        where,
        include: {
          asset: { select: { id: true, assetTag: true, name: true } },
          actor: { select: { id: true, fullName: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.assetHistory.count({ where }),
    ]);
    return { items, total, page: query.page, limit: query.limit };
  }

  private assetListInclude() {
    return {
      category: true,
      assignments: {
        where: { returnedAt: null },
        take: 1,
        orderBy: { assignedAt: 'desc' as const },
        include: {
          user: { select: { id: true, fullName: true, email: true } },
        },
      },
    };
  }

  private async requireAsset(id: string) {
    const asset = await this.prisma.asset.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, status: true, assetTag: true },
    });
    if (!asset) throw new NotFoundException('Asset not found');
    return asset;
  }

  private async requireCategory(id: string) {
    const category = await this.prisma.assetCategory.findUnique({
      where: { id },
    });
    if (!category) throw new NotFoundException('Asset category not found');
    return category;
  }

  private async requireActiveCategory(id: string) {
    const category = await this.prisma.assetCategory.findFirst({
      where: { id, active: true },
      select: { id: true },
    });
    if (!category)
      throw new BadRequestException('Asset category is unavailable');
  }

  private requireAdmin(user: AuthenticatedUser) {
    if (!user.roles.includes('ADMIN')) {
      throw new ForbiddenException('Action requires ADMIN role');
    }
  }

  private requireRequester(user: AuthenticatedUser) {
    if (!user.roles.includes('REQUESTER')) {
      throw new ForbiddenException('Action requires REQUESTER role');
    }
  }

  private requireAnyRole(
    user: AuthenticatedUser,
    roles: AuthenticatedUser['roles'],
  ) {
    if (!user.roles.some((role) => roles.includes(role))) {
      throw new ForbiddenException(
        'You do not have permission for this action',
      );
    }
  }

  private assertId(id: string) {
    if (!ID_PATTERN.test(id))
      throw new BadRequestException('id must be a UUID');
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
