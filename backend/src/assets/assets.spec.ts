import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  AssetQueryDto,
  AssetRecordsQueryDto,
  AssignAssetDto,
  CreateMaintenanceDto,
  CreateAssetDto,
  ReturnAssetDto,
  UpdateMaintenanceDto,
  UpdateAssetDto,
} from './dto/asset.dto.js';
import { AssetsService } from './assets.service.js';

const requester: AuthenticatedUser = {
  id: '10000000-0000-4000-8000-000000000001',
  email: 'requester@example.com',
  fullName: 'Requester',
  roles: ['REQUESTER'],
};

describe('AssetsService', () => {
  it('searches only requester-assigned or explicitly shared available assets', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const service = new AssetsService({
      asset: { findMany },
    } as unknown as PrismaService);

    await service.searchForTicket(
      requester,
      AssetQueryDto.validate({ search: 'lap' }),
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: null,
          OR: [
            { assignments: { some: { userId: requester.id, returnedAt: null } } },
            { sharedReportable: true, status: 'AVAILABLE' },
          ],
          AND: [{ OR: expect.arrayContaining([
            { name: { contains: 'lap', mode: 'insensitive' } },
          ]) }],
        }),
        select: {
          id: true,
          assetTag: true,
          name: true,
          category: { select: { name: true } },
          location: true,
          status: true,
        },
        take: 20,
      }),
    );
  });

  it('keeps requester assigned inventory limited to assets assigned to them', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const service = new AssetsService({
      asset: { findMany },
    } as unknown as PrismaService);

    await service.myAssigned(requester);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: null,
          assignments: { some: { userId: requester.id, returnedAt: null } },
        }),
      }),
    );
  });

  it('denies requesters inventory access even when calling the service directly', async () => {
    const service = new AssetsService({} as PrismaService);
    await expect(
      service.findAll(requester, AssetQueryDto.validate({})),
    ).rejects.toThrow(ForbiddenException);
  });

  it('validates required fields and supports clearing nullable asset metadata', () => {
    expect(() =>
      CreateAssetDto.validate({
        assetTag: 'LAP-001',
        name: 'Laptop',
        categoryId: 'not-a-uuid',
      }),
    ).toThrow(BadRequestException);

    const dto = UpdateAssetDto.validate({ warrantyExpires: null, notes: null });
    expect(dto.warrantyExpires).toBeNull();
    expect(dto.notes).toBeNull();
    expect(CreateAssetDto.validate({ name: 'Shared printer', categoryId: '10000000-0000-4000-8000-000000000001', sharedReportable: true }).sharedReportable).toBe(true);
    expect(() => UpdateAssetDto.validate({ sharedReportable: 'yes' })).toThrow(BadRequestException);
  });

  it('validates bounded filters for collection asset records', () => {
    expect(() => AssetRecordsQueryDto.validate({ limit: 101 })).toThrow(
      BadRequestException,
    );
    expect(() =>
      AssetRecordsQueryDto.validate({
        dateFrom: '2026-02-02',
        dateTo: '2026-02-01',
      }),
    ).toThrow(BadRequestException);
    expect(
      AssetRecordsQueryDto.validate({
        page: '2',
        limit: '25',
        status: 'ACTIVE',
      }),
    ).toMatchObject({ page: 2, limit: 25, status: 'ACTIVE' });
  });

  it('validates assignment condition and maintenance workflow details', () => {
    expect(
      AssignAssetDto.validate({
        userId: '10000000-0000-4000-8000-000000000001',
        conditionAtAssignment: 'GOOD',
      }),
    ).toMatchObject({ conditionAtAssignment: 'GOOD' });
    expect(
      ReturnAssetDto.validate({ conditionAtReturn: 'FAIR' }),
    ).toMatchObject({ conditionAtReturn: 'FAIR' });
    expect(
      CreateMaintenanceDto.validate({
        type: 'REPAIR',
        title: 'Replace battery',
        diagnosis: 'Battery no longer holds charge',
        resolution: 'Replaced battery',
        notes: 'Returned to user',
      }),
    ).toMatchObject({
      type: 'REPAIR',
      diagnosis: 'Battery no longer holds charge',
      resolution: 'Replaced battery',
      notes: 'Returned to user',
    });
    expect(
      UpdateMaintenanceDto.validate({
        status: 'COMPLETED',
        diagnosis: 'Battery no longer holds charge',
        resolution: 'Replaced battery',
        notes: 'Verified charging',
      }),
    ).toMatchObject({
      status: 'COMPLETED',
      diagnosis: 'Battery no longer holds charge',
      resolution: 'Replaced battery',
      notes: 'Verified charging',
    });
  });

  it('persists condition snapshots when assigning and returning an asset', async () => {
    const admin: AuthenticatedUser = { ...requester, roles: ['ADMIN'] };
    const assetId = '10000000-0000-4000-8000-000000000002';
    const assignmentId = '10000000-0000-4000-8000-000000000003';
    const assignTx = {
      asset: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      assetAssignment: {
        create: vi.fn().mockResolvedValue({ id: assignmentId }),
      },
      assetHistory: { create: vi.fn().mockResolvedValue({}) },
    };
    const assignPrisma = {
      user: { findFirst: vi.fn().mockResolvedValue({ id: requester.id }) },
      asset: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ id: assetId, status: 'AVAILABLE' }),
      },
      $transaction: vi.fn(async (callback) => callback(assignTx)),
    };
    const assignService = new AssetsService(
      assignPrisma as unknown as PrismaService,
    );

    await assignService.assign(
      admin,
      assetId,
      AssignAssetDto.validate({
        userId: requester.id,
        conditionAtAssignment: 'GOOD',
      }),
    );

    expect(assignTx.assetAssignment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ conditionAtAssignment: 'GOOD' }),
      }),
    );

    const returnTx = {
      asset: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      assetAssignment: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({ id: assignmentId }),
      },
      assetHistory: { create: vi.fn().mockResolvedValue({}) },
    };
    const returnPrisma = {
      asset: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ id: assetId, status: 'ASSIGNED' }),
      },
      assetAssignment: {
        findFirst: vi.fn().mockResolvedValue({
          id: assignmentId,
          assetId,
          userId: requester.id,
        }),
      },
      $transaction: vi.fn(async (callback) => callback(returnTx)),
    };
    const returnService = new AssetsService(
      returnPrisma as unknown as PrismaService,
    );

    await returnService.returnAsset(
      admin,
      assetId,
      ReturnAssetDto.validate({ conditionAtReturn: 'FAIR' }),
    );

    expect(returnTx.assetAssignment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ conditionAtReturn: 'FAIR' }),
      }),
    );
  });

  it('allows technicians to create maintenance and rejects supervisor writes', async () => {
    const technician: AuthenticatedUser = {
      ...requester,
      roles: ['TECHNICIAN'],
    };
    const supervisor: AuthenticatedUser = {
      ...requester,
      roles: ['SUPERVISOR'],
    };
    const tx = {
      assetMaintenance: {
        create: vi.fn().mockResolvedValue({ id: 'maintenance-id' }),
      },
      asset: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      assetHistory: { create: vi.fn().mockResolvedValue({}) },
    };
    const prisma = {
      asset: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ id: 'asset-id', status: 'AVAILABLE' }),
      },
      $transaction: vi.fn(async (callback) => callback(tx)),
    };
    const service = new AssetsService(prisma as unknown as PrismaService);
    const createInput = CreateMaintenanceDto.validate({
      type: 'REPAIR',
      title: 'Replace battery',
      diagnosis: 'Battery fault',
      resolution: 'Replaced battery',
      notes: 'Tested successfully',
    });

    await expect(
      service.createMaintenance(
        supervisor,
        '10000000-0000-4000-8000-000000000002',
        createInput,
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();

    await service.createMaintenance(
      technician,
      '10000000-0000-4000-8000-000000000002',
      createInput,
    );
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(tx.assetMaintenance.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'REPAIR',
          diagnosis: 'Battery fault',
          resolution: 'Replaced battery',
          notes: 'Tested successfully',
        }),
      }),
    );
    expect(tx.assetHistory.create).toHaveBeenCalledOnce();
    expect(tx.asset.updateMany).toHaveBeenCalledWith({
      where: { id: '10000000-0000-4000-8000-000000000002', status: 'AVAILABLE', deletedAt: null },
      data: { status: 'UNDER_MAINTENANCE' },
    });
  });

  it('does not create maintenance after a competing assignment changes asset status', async () => {
    const technician: AuthenticatedUser = { ...requester, roles: ['TECHNICIAN'] };
    const assetId = '10000000-0000-4000-8000-000000000002';
    const tx = {
      asset: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      assetMaintenance: { create: vi.fn() },
    };
    const service = new AssetsService({
      asset: { findFirst: vi.fn().mockResolvedValue({ id: assetId, status: 'AVAILABLE' }) },
      $transaction: vi.fn(async (callback) => callback(tx)),
    } as unknown as PrismaService);
    await expect(service.createMaintenance(
      technician, assetId, CreateMaintenanceDto.validate({ title: 'Repair' }),
    )).rejects.toThrow(ConflictException);
    expect(tx.assetMaintenance.create).not.toHaveBeenCalled();
  });

  it('allows technicians to update maintenance while preserving transactional history', async () => {
    const technician: AuthenticatedUser = {
      ...requester,
      roles: ['TECHNICIAN'],
    };
    const supervisor: AuthenticatedUser = {
      ...requester,
      roles: ['SUPERVISOR'],
    };
    const existing = {
      id: '10000000-0000-4000-8000-000000000003',
      status: 'IN_PROGRESS',
      startedAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    };
    const tx = {
      assetMaintenance: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({ ...existing, status: 'COMPLETED' }),
        count: vi.fn().mockResolvedValue(0),
      },
      asset: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      assetHistory: { create: vi.fn().mockResolvedValue({}) },
    };
    const prisma = {
      assetMaintenance: { findFirst: vi.fn().mockResolvedValue(existing) },
      $transaction: vi.fn(async (callback) => callback(tx)),
    };
    const service = new AssetsService(prisma as unknown as PrismaService);
    const assetId = '10000000-0000-4000-8000-000000000002';
    const maintenanceId = existing.id;
    const updateInput = UpdateMaintenanceDto.validate({
      status: 'COMPLETED',
      diagnosis: 'Battery fault',
      resolution: 'Replaced battery',
      notes: 'Tested successfully',
    });

    await expect(
      service.updateMaintenance(
        supervisor,
        assetId,
        maintenanceId,
        updateInput,
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();

    await service.updateMaintenance(
      technician,
      assetId,
      maintenanceId,
      updateInput,
    );
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(tx.assetMaintenance.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'IN_PROGRESS', updatedAt: existing.updatedAt }),
        data: expect.objectContaining({
          status: 'COMPLETED',
          diagnosis: 'Battery fault',
          resolution: 'Replaced battery',
          notes: 'Tested successfully',
        }),
      }),
    );
    expect(tx.assetHistory.create).toHaveBeenCalledOnce();
  });

  it('filters and paginates collection history records', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);
    const service = new AssetsService({
      assetHistory: { findMany, count },
    } as unknown as PrismaService);
    const query = AssetRecordsQueryDto.validate({
      assetId: '10000000-0000-4000-8000-000000000002',
      type: 'STATUS_CHANGED',
      dateFrom: '2026-01-01',
      page: 2,
      limit: 10,
    });

    await service.historyRecords(
      { ...requester, roles: ['SUPERVISOR'] },
      query,
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          assetId: query.assetId,
          action: 'STATUS_CHANGED',
          createdAt: { gte: query.dateFrom },
        }),
        skip: 10,
        take: 10,
      }),
    );
    expect(count).toHaveBeenCalledOnce();
  });
});
