import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CategoriesService } from '../categories/categories.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TicketActionDto } from './dto/ticket-action.dto.js';
import {
  AssignTicketDto,
  OverridePriorityDto,
  TriageTicketDto,
} from './dto/supervisor-ticket.dto.js';
import { computeTicketSla } from './ticket-sla.js';
import { TicketsService } from './tickets.service.js';

const supervisor = {
  id: 'sup-id',
  email: 'supervisor@helpdesk.local',
  fullName: 'Supervisor',
  roles: ['SUPERVISOR' as const],
};

const requester = {
  id: 'req-id',
  email: 'requester@helpdesk.local',
  fullName: 'Requester',
  roles: ['REQUESTER' as const],
};

const technician = {
  id: 'tech-1',
  email: 'tech1@helpdesk.local',
  fullName: 'Tech One',
  roles: ['TECHNICIAN' as const],
};

const adminOnly = {
  id: 'admin-id',
  email: 'admin@helpdesk.local',
  fullName: 'Admin',
  roles: ['ADMIN' as const],
};

function serviceWith(prisma: Record<string, unknown>): TicketsService {
  return new TicketsService(
    prisma as unknown as PrismaService,
    {} as CategoriesService,
  );
}

describe('Supervisor Ticket Workflow, Dashboard & SLA Foundation', () => {
  describe('Supervisor DTO validation', () => {
    it('validates TriageTicketDto, AssignTicketDto, and OverridePriorityDto', () => {
      const triage = TriageTicketDto.validate({
        version: 1,
        impact: 'HIGH',
        urgency: 'MEDIUM',
        reason: '  Xác nhận ảnh hưởng phòng kế toán  ',
      });
      expect(triage).toMatchObject({
        version: 1,
        impact: 'HIGH',
        urgency: 'MEDIUM',
        reason: 'Xác nhận ảnh hưởng phòng kế toán',
      });

      const assign = AssignTicketDto.validate({
        version: 2,
        assigneeId: ' 10000000-0000-4000-8000-000000000001 ',
        reason: ' Giao kỹ thuật mạng ',
      });
      expect(assign).toMatchObject({
        version: 2,
        assigneeId: '10000000-0000-4000-8000-000000000001',
        reason: 'Giao kỹ thuật mạng',
      });

      const override = OverridePriorityDto.validate({
        version: 3,
        priority: 'P1',
        reason: '  Sự cố ảnh hưởng kỳ chốt sổ kế toán  ',
      });
      expect(override).toMatchObject({
        version: 3,
        priority: 'P1',
        reason: 'Sự cố ảnh hưởng kỳ chốt sổ kế toán',
      });

      expect(() =>
        AssignTicketDto.validate({ version: 1, assigneeId: 'not-a-uuid' }),
      ).toThrow(BadRequestException);
      expect(() =>
        OverridePriorityDto.validate({
          version: 1,
          priority: 'P1',
          reason: 'ab',
        }),
      ).toThrow(BadRequestException);
    });
  });

  describe('RBAC enforcement for Supervisor endpoints', () => {
    it('denies non-SUPERVISOR accounts (including ADMIN-only) from Supervisor actions', async () => {
      const service = serviceWith({});
      const triageDto = TriageTicketDto.validate({ version: 1 });
      const assignDto = AssignTicketDto.validate({
        version: 1,
        assigneeId: '10000000-0000-4000-8000-000000000001',
      });
      const rejectDto = TicketActionDto.validate(
        { version: 1, reason: 'Trùng yêu cầu' },
        true,
      );
      const overrideDto = OverridePriorityDto.validate({
        version: 1,
        priority: 'P2',
        reason: 'Cần xử lý gấp',
      });

      for (const actor of [requester, technician, adminOnly]) {
        await expect(
          service.triageTicket(actor, 'ticket-1', triageDto),
        ).rejects.toThrow(ForbiddenException);
        await expect(
          service.assignTicket(actor, 'ticket-1', assignDto),
        ).rejects.toThrow(ForbiddenException);
        await expect(
          service.rejectTicket(actor, 'ticket-1', rejectDto),
        ).rejects.toThrow(ForbiddenException);
        await expect(
          service.overridePriority(actor, 'ticket-1', overrideDto),
        ).rejects.toThrow(ForbiddenException);
        await expect(service.getSupervisorDashboard(actor)).rejects.toThrow(
          ForbiddenException,
        );
        await expect(service.listTechnicians(actor)).rejects.toThrow(
          ForbiddenException,
        );
      }
    });
  });

  describe('Triage (NEW -> TRIAGED) & Priority Matrix', () => {
    it('triages a NEW ticket, calculates 3x3 priority, and records audit history', async () => {
      const now = new Date('2026-11-20T09:00:00.000Z');
      const tx = {
        ticket: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'ticket-1',
            status: 'NEW',
            categoryId: '10000000-0000-4000-8000-000000000001',
            impact: 'MEDIUM',
            urgency: 'LOW',
            priority: 'P4',
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        ticketActivity: { create: vi.fn() },
      };
      const service = serviceWith({
        $transaction: vi.fn((cb) => cb(tx)),
        ticket: {
          findFirst: vi
            .fn()
            .mockResolvedValue({ id: 'ticket-1', status: 'TRIAGED', priority: 'P2' }),
        },
      });

      const result = await service.triageTicket(
        supervisor,
        'ticket-1',
        TriageTicketDto.validate({
          version: 1,
          impact: 'HIGH',
          urgency: 'MEDIUM',
          reason: 'Ảnh hưởng cả tầng 3',
        }),
        now,
      );

      expect(result).toEqual({
        id: 'ticket-1',
        status: 'TRIAGED',
        priority: 'P2',
      });
      expect(tx.ticket.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ticket-1', status: 'NEW', version: 1 },
          data: expect.objectContaining({
            status: 'TRIAGED',
            impact: 'HIGH',
            urgency: 'MEDIUM',
            priority: 'P2',
          }),
        }),
      );
      expect(tx.ticketActivity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actorId: supervisor.id,
            fromStatus: 'NEW',
            toStatus: 'TRIAGED',
          }),
        }),
      );
    });

    it('requires a reason if priority is manually overridden during triage (BR-02)', async () => {
      const tx = {
        ticket: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'ticket-1',
            status: 'NEW',
            categoryId: '10000000-0000-4000-8000-000000000001',
            impact: 'LOW',
            urgency: 'LOW',
            priority: 'P4',
          }),
          updateMany: vi.fn(),
        },
        ticketActivity: { create: vi.fn() },
      };
      const service = serviceWith({ $transaction: vi.fn((cb) => cb(tx)) });

      await expect(
        service.triageTicket(
          supervisor,
          'ticket-1',
          TriageTicketDto.validate({
            version: 1,
            priority: 'P1',
          }),
        ),
      ).rejects.toThrow(BadRequestException);
      expect(tx.ticket.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('Assign & Reassign Technician (BR-01 & Audit)', () => {
    const techId1 = '10000000-0000-4000-8000-000000000011';
    const techId2 = '10000000-0000-4000-8000-000000000022';

    it('enforces BR-01 by rejecting assignment of an untriaged NEW ticket', async () => {
      const tx = {
        ticket: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'ticket-1',
            status: 'NEW',
            requesterId: requester.id,
            assigneeId: null,
            assignee: null,
          }),
          updateMany: vi.fn(),
        },
      };
      const service = serviceWith({ $transaction: vi.fn((cb) => cb(tx)) });

      await expect(
        service.assignTicket(
          supervisor,
          'ticket-1',
          AssignTicketDto.validate({ version: 1, assigneeId: techId1 }),
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('prevents assigning a Technician to their own requested ticket', async () => {
      const tx = {
        ticket: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'ticket-1',
            status: 'TRIAGED',
            requesterId: techId1,
            assigneeId: null,
            assignee: null,
          }),
          updateMany: vi.fn(),
        },
      };
      const service = serviceWith({ $transaction: vi.fn((cb) => cb(tx)) });

      await expect(
        service.assignTicket(
          supervisor,
          'ticket-1',
          AssignTicketDto.validate({ version: 2, assigneeId: techId1 }),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('assigns a TRIAGED ticket to ASSIGNED and logs reassignment history when changing technician', async () => {
      const tx = {
        ticket: {
          findFirst: vi
            .fn()
            .mockResolvedValueOnce({
              id: 'ticket-1',
              status: 'TRIAGED',
              requesterId: requester.id,
              assigneeId: null,
              assignee: null,
            })
            .mockResolvedValueOnce({
              id: 'ticket-1',
              status: 'ASSIGNED',
              requesterId: requester.id,
              assigneeId: techId1,
              assignee: { id: techId1, fullName: 'Tech One' },
            }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        user: {
          findFirst: vi
            .fn()
            .mockResolvedValueOnce({ id: techId1, fullName: 'Tech One' })
            .mockResolvedValueOnce({ id: techId2, fullName: 'Tech Two' }),
        },
        ticketActivity: { create: vi.fn() },
      };
      const service = serviceWith({
        $transaction: vi.fn((cb) => cb(tx)),
        ticket: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'ticket-1',
            status: 'ASSIGNED',
          }),
        },
      });

      await service.assignTicket(
        supervisor,
        'ticket-1',
        AssignTicketDto.validate({ version: 2, assigneeId: techId1 }),
      );
      expect(tx.ticketActivity.create).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            fromStatus: 'TRIAGED',
            toStatus: 'ASSIGNED',
            content: 'Phân công kỹ thuật viên: Tech One',
          }),
        }),
      );

      await service.assignTicket(
        supervisor,
        'ticket-1',
        AssignTicketDto.validate({
          version: 3,
          assigneeId: techId2,
          reason: 'Điều chuyển ca trực',
        }),
      );
      expect(tx.ticketActivity.create).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            fromStatus: 'ASSIGNED',
            toStatus: 'ASSIGNED',
            content:
              'Phân công lại kỹ thuật viên: Tech One → Tech Two · Lý do: Điều chuyển ca trực',
          }),
        }),
      );
    });
  });

  describe('Reject & Override Priority', () => {
    it('rejects a NEW or TRIAGED ticket with a mandatory reason and blocks rejecting IN_PROGRESS tickets', async () => {
      const tx = {
        ticket: {
          findFirst: vi
            .fn()
            .mockResolvedValueOnce({ id: 'ticket-1', status: 'NEW' })
            .mockResolvedValueOnce({ id: 'ticket-1', status: 'IN_PROGRESS' }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        ticketActivity: { create: vi.fn() },
      };
      const service = serviceWith({
        $transaction: vi.fn((cb) => cb(tx)),
        ticket: {
          findFirst: vi
            .fn()
            .mockResolvedValue({ id: 'ticket-1', status: 'REJECTED' }),
        },
      });

      await expect(
        service.rejectTicket(
          supervisor,
          'ticket-1',
          TicketActionDto.validate(
            { version: 1, reason: 'Yêu cầu trùng với INC-2026-0001' },
            true,
          ),
        ),
      ).resolves.toEqual({ id: 'ticket-1', status: 'REJECTED' });

      await expect(
        service.rejectTicket(
          supervisor,
          'ticket-1',
          TicketActionDto.validate(
            { version: 2, reason: 'Không hợp lệ' },
            true,
          ),
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('overrides priority with mandatory reason and logs audit trail', async () => {
      const tx = {
        ticket: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'ticket-1',
            status: 'ASSIGNED',
            priority: 'P3',
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        ticketActivity: { create: vi.fn() },
      };
      const service = serviceWith({
        $transaction: vi.fn((cb) => cb(tx)),
        ticket: {
          findFirst: vi
            .fn()
            .mockResolvedValue({ id: 'ticket-1', priority: 'P1' }),
        },
      });

      await expect(
        service.overridePriority(
          supervisor,
          'ticket-1',
          OverridePriorityDto.validate({
            version: 3,
            priority: 'P1',
            reason: 'Ảnh hưởng hệ thống thanh toán',
          }),
        ),
      ).resolves.toEqual({ id: 'ticket-1', priority: 'P1' });

      expect(tx.ticketActivity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            content:
              'Điều chỉnh mức ưu tiên: P3 → P1 · Lý do: Ảnh hưởng hệ thống thanh toán',
          }),
        }),
      );
    });
  });

  describe('SLA Calculation & Dashboard V1 Aggregation', () => {
    it('uses the persisted policy snapshot even after the active policy changes', async () => {
      const ticketStore = {
        findFirst: vi.fn().mockResolvedValue({
          id: 'ticket-1', priority: 'P1', status: 'IN_PROGRESS',
          createdAt: new Date('2026-11-20T08:00:00.000Z'),
          resolvedAt: null, closedAt: null,
          ticketSla: {
            policyRevision: 2, responseTargetMinutes: 30, resolutionTargetMinutes: 240,
            responseDueAt: new Date('2026-11-20T08:30:00.000Z'),
            resolutionDueAt: new Date('2026-11-20T12:00:00.000Z'),
            firstResponseAt: new Date('2026-11-20T08:20:00.000Z'),
          },
        }),
      };
      const service = serviceWith({ ticket: ticketStore });
      const snapshot = await service.getTicketSla(requester, 'ticket-1', new Date('2026-11-20T09:00:00.000Z'));

      expect(snapshot.responseStatus).toBe('MET');
      expect(snapshot.policyRevision).toBe(2);
      expect(snapshot.responseDueAt).toBe('2026-11-20T08:30:00.000Z');
      expect(ticketStore.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'ticket-1', AND: [{ requesterId: requester.id }] },
        select: expect.objectContaining({ ticketSla: true }),
      }));
      await expect(service.getTicketSla(adminOnly, 'ticket-1')).rejects.toThrow(ForbiddenException);
      expect(ticketStore.findFirst).toHaveBeenCalledTimes(1);
    });

    it('fails explicitly when a legacy Ticket has no reviewed SLA snapshot', async () => {
      const service = serviceWith({
        ticket: { findFirst: vi.fn().mockResolvedValue({
          id: 'ticket-1', priority: 'P1', status: 'NEW',
          createdAt: new Date('2026-11-20T08:00:00.000Z'),
          resolvedAt: null, closedAt: null, ticketSla: null,
        }) },
      });
      await expect(service.getTicketSla(requester, 'ticket-1')).rejects.toThrow(ServiceUnavailableException);
    });

    it('evaluates ON_TRACK, AT_RISK (80%), BREACHED (100%), and MET SLA states accurately', () => {
      const createdAt = new Date('2026-11-20T08:00:00.000Z');
      const snapshot = {
        policyRevision: 1, responseTargetMinutes: 15, resolutionTargetMinutes: 240,
        responseDueAt: new Date('2026-11-20T08:15:00.000Z'),
        resolutionDueAt: new Date('2026-11-20T12:00:00.000Z'),
        firstResponseAt: null as Date | null,
      };
      const ticket = {
        id: 't-p1',
        priority: 'P1' as const,
        status: 'ASSIGNED' as const,
        createdAt,
        resolvedAt: null,
        closedAt: null,
      };

      expect(
        computeTicketSla(ticket, snapshot, new Date('2026-11-20T08:10:00.000Z'))
          .responseStatus,
      ).toBe('ON_TRACK');
      expect(
        computeTicketSla(ticket, snapshot, new Date('2026-11-20T08:12:00.000Z'))
          .responseStatus,
      ).toBe('AT_RISK');
      expect(
        computeTicketSla(ticket, snapshot, new Date('2026-11-20T08:16:00.000Z'))
          .responseStatus,
      ).toBe('BREACHED');
      expect(
        computeTicketSla(
          ticket,
          { ...snapshot, firstResponseAt: new Date('2026-11-20T08:05:00.000Z') },
          new Date('2026-11-20T09:00:00.000Z'),
        ).responseStatus,
      ).toBe('MET');

      const resolved = {
        ...ticket,
        status: 'RESOLVED' as const,
        resolvedAt: new Date('2026-11-20T09:00:00.000Z'),
      };
      expect(computeTicketSla(resolved, snapshot, new Date('2026-11-21T08:00:00.000Z')).resolutionStatus).toBe('MET');
      expect(computeTicketSla(ticket, { ...snapshot, responseTargetMinutes: 30, responseDueAt: new Date('2026-11-20T08:30:00.000Z') }, new Date('2026-11-20T08:16:00.000Z')).responseStatus).toBe('ON_TRACK');
      expect(computeTicketSla({ ...resolved, status: 'ASSIGNED', resolvedAt: null }, snapshot, new Date('2026-11-20T12:01:00.000Z')).resolutionStatus).toBe('BREACHED');
    });

    it('aggregates real ticket counts, SLA status, and technician workload for Dashboard V1', async () => {
      const createdAt = new Date('2026-11-20T08:00:00.000Z');
      const now = new Date('2026-11-20T08:20:00.000Z');
      const service = serviceWith({
        ticket: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 't1',
              requesterId: requester.id,
              assigneeId: null,
              priority: 'P1',
              status: 'NEW',
              createdAt,
              resolvedAt: null,
              closedAt: null,
              ticketSla: {
                policyRevision: 1, responseTargetMinutes: 15, resolutionTargetMinutes: 240,
                responseDueAt: new Date('2026-11-20T08:15:00.000Z'),
                resolutionDueAt: new Date('2026-11-20T12:00:00.000Z'),
                firstResponseAt: null,
              },
            },
            {
              id: 't2',
              requesterId: requester.id,
              assigneeId: technician.id,
              priority: 'P3',
              status: 'IN_PROGRESS',
              createdAt,
              resolvedAt: null,
              closedAt: null,
              ticketSla: {
                policyRevision: 1, responseTargetMinutes: 240, resolutionTargetMinutes: 1440,
                responseDueAt: new Date('2026-11-20T12:00:00.000Z'),
                resolutionDueAt: new Date('2026-11-21T08:00:00.000Z'),
                firstResponseAt: new Date('2026-11-20T08:10:00.000Z'),
              },
            },
            {
              id: 'legacy', assigneeId: null, priority: 'P4', status: 'CLOSED',
              createdAt, resolvedAt: null, closedAt: now, ticketSla: null,
            },
          ]),
        },
        user: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: technician.id,
              fullName: technician.fullName,
              email: technician.email,
              assignedTickets: [{ status: 'IN_PROGRESS' }],
            },
          ]),
        },
      });

      const dashboard = await service.getSupervisorDashboard(supervisor, now);
      expect(dashboard.totalTickets).toBe(3);
      expect(dashboard.unassignedCount).toBe(1);
      expect(dashboard.triageQueueCount).toBe(1);
      expect(dashboard.byStatus.NEW).toBe(1);
      expect(dashboard.byStatus.IN_PROGRESS).toBe(1);
      expect(dashboard.byPriority.P1).toBe(1);
      expect(dashboard.byPriority.P3).toBe(1);
      expect(dashboard.sla.breached).toBe(1);
      expect(dashboard.sla.onTrack).toBe(1);
      expect(dashboard.sla.unknown).toBe(1);
      expect(dashboard.workloadByTechnician).toEqual([
        expect.objectContaining({
          id: technician.id,
          activeAssignedCount: 1,
          inProgressCount: 1,
        }),
      ]);
    });
  });
});
