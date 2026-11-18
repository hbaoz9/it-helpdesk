import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesService } from '../categories/categories.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateTicketDto } from './dto/create-ticket.dto.js';
import { TicketQueryDto } from './dto/ticket-query.dto.js';
import { UpdateTicketDto } from './dto/update-ticket.dto.js';
import { TicketsController } from './tickets.controller.js';
import { TicketsModule } from './tickets.module.js';
import { TicketsService } from './tickets.service.js';

describe('TicketsModule', () => {
  let ticketsController: TicketsController;
  let ticketsService: TicketsService;
  let categoriesService: CategoriesService;
  let prismaMock: Partial<PrismaService>;

  beforeEach(async () => {
    process.env.AUTH_SESSION_SECRET ??=
      'test-session-secret-with-at-least-32-bytes';
    prismaMock = {};

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [TicketsModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    ticketsController = moduleRef.get<TicketsController>(TicketsController);
    ticketsService = moduleRef.get<TicketsService>(TicketsService);
    categoriesService = moduleRef.get<CategoriesService>(CategoriesService);
  });

  it('should initialize TicketsController, TicketsService, and CategoriesService dependency', () => {
    expect(ticketsController).toBeDefined();
    expect(ticketsService).toBeDefined();
    expect(ticketsService.getPrismaClient()).toBe(prismaMock);
    expect(ticketsService.getCategoriesService()).toBe(categoriesService);
  });

  describe('DTO Validation', () => {
    it('should validate a valid CreateTicketDto payload', () => {
      const dto = CreateTicketDto.validate({
        title: '  Cannot connect to VPN  ',
        description: '  VPN client shows error 809  ',
        categoryId: '  10000000-0000-4000-8000-000000000001  ',
        impact: 'MEDIUM',
        urgency: 'HIGH',
      });

      expect(dto.title).toBe('Cannot connect to VPN');
      expect(dto.description).toBe('VPN client shows error 809');
      expect(dto.categoryId).toBe('10000000-0000-4000-8000-000000000001');
      expect(dto.impact).toBe('MEDIUM');
      expect(dto.urgency).toBe('HIGH');
    });

    it('should reject invalid CreateTicketDto payloads', () => {
      expect(() => CreateTicketDto.validate(null)).toThrow(BadRequestException);
      expect(() =>
        CreateTicketDto.validate({
          title: '',
          description: 'desc',
          categoryId: '10000000-0000-4000-8000-000000000001',
          impact: 'LOW',
          urgency: 'LOW',
        }),
      ).toThrow(BadRequestException);
      expect(() =>
        CreateTicketDto.validate({
          title: 'Title',
          description: '',
          categoryId: '10000000-0000-4000-8000-000000000001',
          impact: 'LOW',
          urgency: 'LOW',
        }),
      ).toThrow(BadRequestException);
      expect(() =>
        CreateTicketDto.validate({
          title: 'Title',
          description: 'desc',
          categoryId: '',
          impact: 'LOW',
          urgency: 'LOW',
        }),
      ).toThrow(BadRequestException);
      expect(() =>
        CreateTicketDto.validate({
          title: 'Title',
          description: 'desc',
          categoryId: '10000000-0000-4000-8000-000000000001',
          impact: 'URGENT',
          urgency: 'LOW',
        }),
      ).toThrow(BadRequestException);
    });

    it('should validate UpdateTicketDto and reject invalid fields', () => {
      const dto = UpdateTicketDto.validate({
        title: ' Updated Title ',
        categoryId: ' 10000000-0000-4000-8000-000000000002 ',
      });

      expect(dto.title).toBe('Updated Title');
      expect(dto.categoryId).toBe('10000000-0000-4000-8000-000000000002');

      expect(() => UpdateTicketDto.validate({ title: '   ' })).toThrow(
        BadRequestException,
      );
      expect(() => UpdateTicketDto.validate([])).toThrow(BadRequestException);
    });

    it('should validate TicketQueryDto', () => {
      const dto = TicketQueryDto.validate({
        categoryId: ' 10000000-0000-4000-8000-000000000001 ',
        status: ' NEW ',
        page: '1',
        limit: '20',
      });

      expect(dto.categoryId).toBe('10000000-0000-4000-8000-000000000001');
      expect(dto.status).toBe('NEW');
      expect(dto.page).toBe(1);
      expect(dto.limit).toBe(20);

      expect(() => TicketQueryDto.validate({ page: '0' })).toThrow(
        BadRequestException,
      );
      expect(() => TicketQueryDto.validate({ limit: '500' })).toThrow(
        BadRequestException,
      );
    });
  });

  it('denies ADMIN-only Ticket reads before querying data', async () => {
    const admin = {
      id: 'admin-id', email: 'admin@example.com', fullName: 'Admin',
      roles: ['ADMIN' as const],
    };
    await expect(ticketsService.findAll(admin, TicketQueryDto.validate({}))).rejects.toThrow(ForbiddenException);
    await expect(ticketsService.findById(admin, 'ticket-id')).rejects.toThrow(ForbiddenException);
  });

  it('combines only assigned and owned Ticket access for REQUESTER + TECHNICIAN', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    prismaMock.ticket = { findMany } as unknown as PrismaService['ticket'];
    const user = {
      id: 'multi-id', email: 'multi@example.com', fullName: 'Multi',
      roles: ['REQUESTER', 'TECHNICIAN', 'ADMIN'] as ('REQUESTER' | 'TECHNICIAN' | 'ADMIN')[],
    };
    await ticketsService.findAll(user, TicketQueryDto.validate({ search: 'printer' }));
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        AND: [{ OR: [{ requesterId: user.id }, { assigneeId: user.id }] }],
        OR: [
          { code: { contains: 'printer' } },
          { title: { contains: 'printer' } },
          { description: { contains: 'printer' } },
        ],
      },
    }));
  });

  it('keeps Requester Ticket creation and priority calculation available', async () => {
    const categoryId = '10000000-0000-4000-8000-000000000001';
    const create = vi.fn().mockResolvedValue({ code: 'INC-TEST' });
    prismaMock.category = { findFirst: vi.fn().mockResolvedValue({ id: categoryId }) } as unknown as PrismaService['category'];
    prismaMock.ticket = { create } as unknown as PrismaService['ticket'];
    const requester = {
      id: 'requester-id', email: 'requester@example.com', fullName: 'Requester',
      roles: ['REQUESTER' as const],
    };
    const dto = CreateTicketDto.validate({
      title: 'Cannot connect to office Wi-Fi', description: 'Office Wi-Fi has been unavailable since morning',
      categoryId, impact: 'HIGH', urgency: 'HIGH',
    });
    await expect(ticketsService.create(requester, dto)).resolves.toEqual({ code: 'INC-TEST' });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ requesterId: requester.id, priority: 'P1' }),
    }));
  });
});
