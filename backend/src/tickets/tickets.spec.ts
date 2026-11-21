import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesService } from '../categories/categories.service.js';
import { REQUIRED_ROLES } from '../auth/roles.decorator.js';
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
      expect(TicketQueryDto.validate({ scope: 'requested' }).scope).toBe('requested');
      expect(TicketQueryDto.validate({ scope: 'assigned' }).scope).toBe('assigned');
      expect(() => TicketQueryDto.validate({ scope: 'all' })).toThrow(BadRequestException);

      expect(() => TicketQueryDto.validate({ page: '0' })).toThrow(
        BadRequestException,
      );
      expect(() => TicketQueryDto.validate({ limit: '500' })).toThrow(
        BadRequestException,
      );
    });
  });

  it('limits requester-scoped lists to tickets created by the requester', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    prismaMock.ticket = { findMany } as unknown as PrismaService['ticket'];
    const user = {
      id: 'multi-id', email: 'multi@example.com', fullName: 'Multi',
      roles: ['REQUESTER', 'TECHNICIAN'] as ('REQUESTER' | 'TECHNICIAN')[],
    };
    await ticketsService.findAll(user, TicketQueryDto.validate({ scope: 'requested', page: '2', limit: '10' }));
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { requesterId: user.id }, skip: 10, take: 10,
    }));
  });

  it('does not grant ADMIN-only accounts Ticket route access', () => {
    for (const method of [
      'findAll', 'findById', 'create', 'countRequested',
      'getRequesterActivity', 'addRequesterComment', 'closeRequesterTicket', 'reopenRequesterTicket',
      'getTechnicianSummary', 'getTechnicianActivity', 'startAssignedTicket',
      'addTechnicianComment', 'addTechnicianNote', 'requestInformation', 'resolveAssignedTicket',
    ] as const) {
      const roles = Reflect.getMetadata(REQUIRED_ROLES, ticketsController[method]) as string[];
      expect(roles).not.toContain('ADMIN');
    }
    for (const method of ['getRequesterActivity', 'addRequesterComment', 'closeRequesterTicket', 'reopenRequesterTicket'] as const) {
      const roles = Reflect.getMetadata(REQUIRED_ROLES, ticketsController[method]) as string[];
      expect(roles).toEqual(['REQUESTER']);
    }
    for (const method of [
      'getTechnicianSummary', 'getTechnicianActivity', 'startAssignedTicket',
      'addTechnicianComment', 'addTechnicianNote', 'requestInformation', 'resolveAssignedTicket',
    ] as const) {
      const roles = Reflect.getMetadata(REQUIRED_ROLES, ticketsController[method]) as string[];
      expect(roles).toEqual(['TECHNICIAN']);
    }
  });

  it('denies ADMIN-only Ticket reads and creation before querying data', async () => {
    const admin = {
      id: 'admin-id', email: 'admin@example.com', fullName: 'Admin',
      roles: ['ADMIN' as const],
    };
    const dto = CreateTicketDto.validate({
      title: 'Cannot connect to VPN', description: 'VPN client shows error 809',
      categoryId: '10000000-0000-4000-8000-000000000001',
      impact: 'MEDIUM', urgency: 'HIGH',
    });
    await expect(ticketsService.findAll(admin, TicketQueryDto.validate({}))).rejects.toThrow(ForbiddenException);
    await expect(ticketsService.findById(admin, 'ticket-id')).rejects.toThrow(ForbiddenException);
    await expect(ticketsService.findAll(admin, TicketQueryDto.validate({ scope: 'requested' }))).rejects.toThrow(ForbiddenException);
    await expect(ticketsService.countRequested(admin, TicketQueryDto.validate({}))).rejects.toThrow(ForbiddenException);
    await expect(ticketsService.create(admin, dto)).rejects.toThrow(ForbiddenException);
    expect(prismaMock.ticket).toBeUndefined();
    expect(prismaMock.category).toBeUndefined();
  });

  it('combines only assigned and owned Ticket access for REQUESTER + TECHNICIAN + ADMIN', async () => {
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
          { code: { contains: 'printer', mode: 'insensitive' } },
          { title: { contains: 'printer', mode: 'insensitive' } },
          { description: { contains: 'printer', mode: 'insensitive' } },
        ],
      },
    }));
  });

  it('restricts Ticket detail to the granted role scopes', async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    prismaMock.ticket = { findFirst } as unknown as PrismaService['ticket'];
    const requester = {
      id: 'requester-id', email: 'requester@example.com', fullName: 'Requester', roles: ['REQUESTER' as const],
    };
    const technician = {
      id: 'tech-id', email: 'tech@example.com', fullName: 'Tech', roles: ['TECHNICIAN' as const],
    };
    await expect(ticketsService.findById(requester, 'ticket-id')).rejects.toThrow();
    expect(findFirst).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { id: 'ticket-id', AND: [{ requesterId: requester.id }] },
    }));
    await expect(ticketsService.findById(technician, 'ticket-id')).rejects.toThrow();
    expect(findFirst).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { id: 'ticket-id', AND: [{ assigneeId: technician.id }] },
    }));
    await expect(ticketsService.findById(technician, 'ticket-id', 'assigned')).rejects.toThrow();
    expect(findFirst).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { id: 'ticket-id', assigneeId: technician.id },
    }));
  });

  it('rejects requester scope when the account has no REQUESTER role', async () => {
    const technician = {
      id: 'tech-id', email: 'tech@example.com', fullName: 'Tech', roles: ['TECHNICIAN' as const],
    };
    await expect(ticketsService.findAll(technician, TicketQueryDto.validate({ scope: 'requested' })))
      .rejects.toThrow(ForbiddenException);
    await expect(ticketsService.findById(technician, 'ticket-id', 'requested'))
      .rejects.toThrow(ForbiddenException);
  });

  it('counts only requester-owned Tickets with the selected filters', async () => {
    const count = vi.fn().mockResolvedValue(4);
    prismaMock.ticket = { count } as unknown as PrismaService['ticket'];
    const requester = {
      id: 'requester-id', email: 'requester@example.com', fullName: 'Requester',
      roles: ['REQUESTER' as const],
    };
    await expect(ticketsService.countRequested(requester, TicketQueryDto.validate({ status: 'NEW', search: 'wifi' })))
      .resolves.toEqual({ total: 4 });
    expect(count).toHaveBeenCalledWith({ where: {
      requesterId: requester.id,
      status: 'NEW',
      OR: [
        { code: { contains: 'wifi', mode: 'insensitive' } },
        { title: { contains: 'wifi', mode: 'insensitive' } },
        { description: { contains: 'wifi', mode: 'insensitive' } },
      ],
    } });
  });

  it('keeps Requester Ticket creation and Backend priority calculation available', async () => {
    const categoryId = '10000000-0000-4000-8000-000000000001';
    const create = vi.fn().mockResolvedValue({ code: 'INC-TEST' });
    const findUnique = vi.fn().mockResolvedValue({
      id: 'policy-p1', priority: 'P1', revision: 3, active: true,
      responseMinutes: 15, resolutionMinutes: 240,
    });
    prismaMock.category = { findFirst: vi.fn().mockResolvedValue({ id: categoryId }) } as unknown as PrismaService['category'];
    prismaMock.$transaction = vi.fn((callback) => callback({
      ticket: { create }, slaPolicy: { findUnique },
    })) as unknown as PrismaService['$transaction'];
    const requester = {
      id: 'requester-id', email: 'requester@example.com', fullName: 'Requester', roles: ['REQUESTER' as const],
    };
    const dto = CreateTicketDto.validate({
      title: 'Cannot connect to office Wi-Fi', description: 'Office Wi-Fi has been unavailable since morning',
      categoryId, impact: 'HIGH', urgency: 'HIGH',
    });
    await expect(ticketsService.create(requester, dto)).resolves.toEqual({ code: 'INC-TEST' });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        requesterId: requester.id, priority: 'P1',
        ticketSla: { create: expect.objectContaining({
          slaPolicyId: 'policy-p1', policyRevision: 3,
          responseTargetMinutes: 15, resolutionTargetMinutes: 240,
          responseDueAt: expect.any(Date), resolutionDueAt: expect.any(Date),
        }) },
      }),
    }));
    const data = create.mock.calls[0][0].data;
    expect(data.ticketSla.create.responseDueAt.getTime() - data.createdAt.getTime()).toBe(15 * 60_000);
    expect(data.ticketSla.create.resolutionDueAt.getTime() - data.createdAt.getTime()).toBe(240 * 60_000);
  });

  it('snapshots each policy revision only for Tickets created after the change', async () => {
    const categoryId = '10000000-0000-4000-8000-000000000001';
    const saved: Array<{ ticketSla: { create: { policyRevision: number; responseTargetMinutes: number; responseDueAt: Date } } }> = [];
    let policy = { id: 'policy-p1', revision: 1, active: true, responseMinutes: 15, resolutionMinutes: 240 };
    prismaMock.category = { findFirst: vi.fn().mockResolvedValue({ id: categoryId }) } as unknown as PrismaService['category'];
    prismaMock.$transaction = vi.fn((callback) => callback({
      slaPolicy: { findUnique: vi.fn(async () => policy) },
      ticket: { create: vi.fn(async ({ data }) => { saved.push(data); return data; }) },
    })) as unknown as PrismaService['$transaction'];
    const requester = {
      id: 'requester-id', email: 'requester@example.com', fullName: 'Requester', roles: ['REQUESTER' as const],
    };
    const dto = CreateTicketDto.validate({
      title: 'Cannot connect to office Wi-Fi', description: 'Office Wi-Fi has been unavailable since morning',
      categoryId, impact: 'HIGH', urgency: 'HIGH',
    });
    await ticketsService.create(requester, dto);
    policy = { ...policy, revision: 2, responseMinutes: 30 };
    await ticketsService.create(requester, dto);
    expect(saved.map(({ ticketSla }) => [ticketSla.create.policyRevision, ticketSla.create.responseTargetMinutes]))
      .toEqual([[1, 15], [2, 30]]);
    expect(saved[0].ticketSla.create.responseDueAt.getTime()).toBeLessThan(saved[1].ticketSla.create.responseDueAt.getTime());
  });
});
