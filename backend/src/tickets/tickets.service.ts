import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  Prisma,
  type TicketSla,
  type TicketImpact,
  type TicketPriority,
  type TicketStatus,
  type TicketUrgency,
} from '../generated/prisma/client.js';
import { CategoriesService } from '../categories/categories.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import type { CreateTicketDto } from './dto/create-ticket.dto.js';
import type { TicketQueryDto } from './dto/ticket-query.dto.js';
import type { TicketActionDto } from './dto/ticket-action.dto.js';
import type { TicketCommentDto } from './dto/ticket-comment.dto.js';
import type {
  AssignTicketDto,
  OverridePriorityDto,
  TriageTicketDto,
} from './dto/supervisor-ticket.dto.js';
import {
  computeTicketSla,
  type PersistedSlaTarget,
  type TicketSlaSnapshot,
} from './ticket-sla.js';

export interface SupervisorTechnicianSummary {
  id: string;
  fullName: string;
  email: string;
  activeAssignedCount: number;
  assignedCount: number;
  inProgressCount: number;
  waitingRequesterCount: number;
  resolvedCount: number;
  closedCount: number;
}

export interface SupervisorDashboardSummary {
  totalTickets: number;
  unassignedCount: number;
  triageQueueCount: number;
  byStatus: Record<TicketStatus, number>;
  byPriority: Record<TicketPriority, number>;
  sla: {
    onTrack: number;
    atRisk: number;
    breached: number;
    met: number;
    unknown: number;
  };
  workloadByTechnician: SupervisorTechnicianSummary[];
}

const OPEN_TICKET_STATUSES: TicketStatus[] = [
  'NEW',
  'TRIAGED',
  'ASSIGNED',
  'IN_PROGRESS',
  'WAITING_REQUESTER',
];
import type { TicketTextActionDto } from './dto/ticket-text-action.dto.js';

@Injectable()
export class TicketsService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(TicketsService.name);
  private closeTimer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly categoriesService: CategoriesService,
  ) {}

  getPrismaClient(): PrismaService {
    return this.prisma;
  }

  getCategoriesService(): CategoriesService {
    return this.categoriesService;
  }

  onApplicationBootstrap(): void {
    this.closeTimer = setInterval(() => {
      void this.closeExpiredTickets().catch(() =>
        this.logger.warn('Ticket auto-close sweep failed'),
      );
    }, 60_000);
    this.closeTimer.unref();
    void this.closeExpiredTickets().catch(() =>
      this.logger.warn('Ticket auto-close sweep failed'),
    );
  }

  onModuleDestroy(): void {
    if (this.closeTimer) clearInterval(this.closeTimer);
  }

  async closeExpiredTickets(now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - 72 * 60 * 60 * 1000);
    const candidates = await this.prisma.ticket.findMany({
      where: { status: 'RESOLVED', resolvedAt: { lte: cutoff } },
      select: { id: true, version: true },
      orderBy: { resolvedAt: 'asc' },
      take: 100,
    });
    let closed = 0;
    for (const candidate of candidates) {
      try {
        const changed = await this.prisma.$transaction(async (tx) => {
          const updated = await tx.ticket.updateMany({
            where: {
              id: candidate.id,
              status: 'RESOLVED',
              version: candidate.version,
              resolvedAt: { lte: cutoff },
            },
            data: {
              status: 'CLOSED',
              closedAt: now,
              version: { increment: 1 },
            },
          });
          if (updated.count !== 1) return false;
          await tx.ticketActivity.create({
            data: {
              ticketId: candidate.id,
              type: 'STATUS',
              visibility: 'PUBLIC',
              fromStatus: 'RESOLVED',
              toStatus: 'CLOSED',
              createdAt: now,
            },
          });
          return true;
        });
        if (changed) closed++;
      } catch {
        this.logger.warn('One Ticket auto-close failed; it will be retried');
      }
    }
    return closed;
  }

  async findAll(user: AuthenticatedUser, query: TicketQueryDto) {
    this.requireTicketRole(user);
    let where: Prisma.TicketWhereInput;
    if (query.scope === 'requested') {
      this.requireRequester(user);
      where = { requesterId: user.id };
    } else if (query.scope === 'assigned') {
      this.requireTechnician(user);
      where = { assigneeId: user.id };
    } else {
      where = { AND: [this.accessScope(user)] };
    }

    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.status) where.status = query.status as TicketStatus;
    if (query.priority) where.priority = query.priority as TicketPriority;
    if (query.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.ticket.findMany({
      where,
      include: {
        category: true,
        requester: { select: { id: true, fullName: true } },
        assignee: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: ((query.page ?? 1) - 1) * (query.limit ?? 100),
      take: query.limit ?? 100,
    });
  }

  async findById(user: AuthenticatedUser, id: string, scope?: 'requested' | 'assigned') {
    this.requireTicketRole(user);
    let where: Prisma.TicketWhereInput;
    if (scope === 'requested') {
      this.requireRequester(user);
      where = { id, requesterId: user.id };
    } else if (scope === 'assigned') {
      this.requireTechnician(user);
      where = { id, assigneeId: user.id };
    } else {
      where = { id, AND: [this.accessScope(user)] };
    }

    const ticket = await this.prisma.ticket.findFirst({
      where,
      include: {
        category: true,
        requester: { select: { id: true, fullName: true, email: true } },
        assignee: { select: { id: true, fullName: true } },
      },
    });
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }
    return ticket;
  }

  async getTechnicianSummary(user: AuthenticatedUser) {
    this.requireTechnician(user);
    const resolvedCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [total, inProgress, waitingRequester, resolved, highPriority, requesterReplyActivities] = await Promise.all([
      this.prisma.ticket.count({ where: { assigneeId: user.id } }),
      this.prisma.ticket.count({ where: { assigneeId: user.id, status: 'IN_PROGRESS' } }),
      this.prisma.ticket.count({ where: { assigneeId: user.id, status: 'WAITING_REQUESTER' } }),
      this.prisma.ticket.count({
        where: {
          assigneeId: user.id,
          status: { in: ['RESOLVED', 'CLOSED'] },
          resolvedAt: { gte: resolvedCutoff },
        },
      }),
      this.prisma.ticket.count({ where: { assigneeId: user.id, status: { notIn: ['RESOLVED', 'CLOSED', 'REJECTED'] }, priority: 'P1' } }),
      this.prisma.ticketActivity.findMany({
        where: {
          type: 'STATUS',
          visibility: 'PUBLIC',
          fromStatus: 'WAITING_REQUESTER',
          toStatus: 'IN_PROGRESS',
          ticket: { assigneeId: user.id, status: 'IN_PROGRESS' },
        },
        select: { ticketId: true },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 100,
      }),
    ]);
    const requesterReplies = new Set(requesterReplyActivities.map((activity) => activity.ticketId)).size;
    return { total, inProgress, waitingRequester, resolved, highPriority, requesterReplies };
  }

  async getTechnicianActivity(user: AuthenticatedUser, id: string) {
    this.requireTechnician(user);
    await this.assertAssignedTicket(this.prisma.ticket, user, id);
    return this.prisma.ticketActivity.findMany({
      where: { ticketId: id },
      select: {
        id: true,
        type: true,
        visibility: true,
        content: true,
        fromStatus: true,
        toStatus: true,
        createdAt: true,
        actor: { select: { id: true, fullName: true } },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  async startAssignedTicket(user: AuthenticatedUser, id: string, dto: TicketActionDto) {
    this.requireTechnician(user);
    await this.prisma.$transaction(async (tx) => {
      const ticket = await this.assertAssignedTicket(tx.ticket, user, id);
      if (ticket.status !== 'ASSIGNED' && ticket.status !== 'WAITING_REQUESTER') {
        throw new ConflictException('Only assigned or requester-waiting tickets can be started');
      }
      const updated = await tx.ticket.updateMany({
        where: { id, assigneeId: user.id, status: ticket.status, version: dto.version },
        data: { status: 'IN_PROGRESS', version: { increment: 1 } },
      });
      if (updated.count !== 1) throw new ConflictException('Ticket changed. Reload and try again');
      const now = new Date();
      await tx.ticketSla.updateMany({
        where: { ticketId: id, firstResponseAt: null },
        data: { firstResponseAt: now },
      });
      await tx.ticketActivity.create({
        data: {
          ticketId: id, actorId: user.id, type: 'STATUS', visibility: 'PUBLIC',
          fromStatus: ticket.status, toStatus: 'IN_PROGRESS',
          createdAt: now,
        },
      });
    });
    return this.findById(user, id, 'assigned');
  }

  async addTechnicianComment(user: AuthenticatedUser, id: string, dto: TicketTextActionDto) {
    return this.addAssignedComment(user, id, dto, 'PUBLIC');
  }

  async addTechnicianNote(user: AuthenticatedUser, id: string, dto: TicketTextActionDto) {
    return this.addAssignedComment(user, id, dto, 'INTERNAL');
  }

  private async addAssignedComment(
    user: AuthenticatedUser,
    id: string,
    dto: TicketTextActionDto,
    visibility: 'PUBLIC' | 'INTERNAL',
  ) {
    this.requireTechnician(user);
    return this.prisma.$transaction(async (tx) => {
      const ticket = await this.assertAssignedTicket(tx.ticket, user, id);
      if (ticket.status !== 'IN_PROGRESS') {
        throw new ConflictException('Ticket must be in progress to add a comment or note');
      }
      const updated = await tx.ticket.updateMany({
        where: { id, assigneeId: user.id, status: 'IN_PROGRESS', version: dto.version },
        data: { version: { increment: 1 } },
      });
      if (updated.count !== 1) throw new ConflictException('Ticket changed. Reload and try again');
      return tx.ticketActivity.create({
        data: {
          ticketId: id, actorId: user.id, type: 'COMMENT', visibility, content: dto.content,
        },
        select: {
          id: true, type: true, visibility: true, content: true, fromStatus: true, toStatus: true,
          createdAt: true, actor: { select: { id: true, fullName: true } },
        },
      });
    });
  }

  async requestInformation(user: AuthenticatedUser, id: string, dto: TicketTextActionDto) {
    this.requireTechnician(user);
    await this.prisma.$transaction(async (tx) => {
      const ticket = await this.assertAssignedTicket(tx.ticket, user, id);
      if (ticket.status !== 'IN_PROGRESS') {
        throw new ConflictException('Only in-progress tickets can request information');
      }
      const updated = await tx.ticket.updateMany({
        where: { id, assigneeId: user.id, status: 'IN_PROGRESS', version: dto.version },
        data: { status: 'WAITING_REQUESTER', version: { increment: 1 } },
      });
      if (updated.count !== 1) throw new ConflictException('Ticket changed. Reload and try again');
      await tx.ticketActivity.create({
        data: {
          ticketId: id, actorId: user.id, type: 'STATUS', visibility: 'PUBLIC',
          content: dto.content, fromStatus: 'IN_PROGRESS', toStatus: 'WAITING_REQUESTER',
        },
      });
    });
    return this.findById(user, id, 'assigned');
  }

  async resolveAssignedTicket(user: AuthenticatedUser, id: string, dto: TicketTextActionDto) {
    this.requireTechnician(user);
    await this.prisma.$transaction(async (tx) => {
      const ticket = await this.assertAssignedTicket(tx.ticket, user, id);
      if (ticket.status !== 'IN_PROGRESS') {
        throw new ConflictException('Only in-progress tickets can be resolved');
      }
      const now = new Date();
      const updated = await tx.ticket.updateMany({
        where: { id, assigneeId: user.id, status: 'IN_PROGRESS', version: dto.version },
        data: {
          status: 'RESOLVED', resolutionNote: dto.content, resolvedAt: now,
          closedAt: null, version: { increment: 1 },
        },
      });
      if (updated.count !== 1) throw new ConflictException('Ticket changed. Reload and try again');
      await tx.ticketSla.updateMany({
        where: { ticketId: id },
        data: { lastResolvedAt: now },
      });
      await tx.ticketActivity.create({
        data: {
          ticketId: id, actorId: user.id, type: 'STATUS', visibility: 'PUBLIC',
          content: dto.content, fromStatus: 'IN_PROGRESS', toStatus: 'RESOLVED', createdAt: now,
        },
      });
    });
    return this.findById(user, id, 'assigned');
  }

  async countRequested(user: AuthenticatedUser, query: TicketQueryDto) {
    this.requireRequester(user);
    const where: Prisma.TicketWhereInput = { requesterId: user.id };
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.status) where.status = query.status as TicketStatus;
    if (query.priority) where.priority = query.priority as TicketPriority;
    if (query.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    return { total: await this.prisma.ticket.count({ where }) };
  }

  async getRequesterActivity(user: AuthenticatedUser, id: string) {
    this.requireRequester(user);
    const ticket = await this.prisma.ticket.findFirst({
      where: { id, requesterId: user.id },
      select: { id: true },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return this.prisma.ticketActivity.findMany({
      where: { ticketId: id, visibility: 'PUBLIC' },
      select: {
        id: true,
        type: true,
        content: true,
        fromStatus: true,
        toStatus: true,
        createdAt: true,
        actor: { select: { id: true, fullName: true } },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  async addRequesterComment(
    user: AuthenticatedUser,
    id: string,
    dto: TicketCommentDto,
  ) {
    this.requireRequester(user);
    const activity = await this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findFirst({
        where: { id, requesterId: user.id },
        select: { status: true },
      });
      if (!ticket) throw new NotFoundException('Ticket not found');
      if (!OPEN_TICKET_STATUSES.includes(ticket.status)) {
        throw new ConflictException('This ticket is not open for comments');
      }
      const updated = await tx.ticket.updateMany({
        where: {
          id,
          requesterId: user.id,
          version: dto.version,
          status: { in: OPEN_TICKET_STATUSES },
        },
        data: ticket.status === 'WAITING_REQUESTER'
          ? { status: 'IN_PROGRESS', version: { increment: 1 } }
          : { version: { increment: 1 } },
      });
      if (updated.count !== 1) {
        throw new ConflictException('Ticket changed. Reload and try again');
      }
      if (ticket.status === 'WAITING_REQUESTER') {
        await tx.ticketActivity.create({
          data: {
            ticketId: id,
            actorId: user.id,
            type: 'STATUS',
            visibility: 'PUBLIC',
            fromStatus: 'WAITING_REQUESTER',
            toStatus: 'IN_PROGRESS',
          },
        });
      }
      return tx.ticketActivity.create({
        data: {
          ticketId: id,
          actorId: user.id,
          type: 'COMMENT',
          visibility: 'PUBLIC',
          content: dto.content,
        },
        select: {
          id: true,
          type: true,
          content: true,
          fromStatus: true,
          toStatus: true,
          createdAt: true,
          actor: { select: { id: true, fullName: true } },
        },
      });
    });
    return activity;
  }

  async closeRequesterTicket(
    user: AuthenticatedUser,
    id: string,
    dto: TicketActionDto,
  ) {
    this.requireRequester(user);
    await this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findFirst({
        where: { id, requesterId: user.id },
        select: { status: true },
      });
      if (!ticket) throw new NotFoundException('Ticket not found');
      if (ticket.status !== 'RESOLVED') {
        throw new ConflictException('Only resolved tickets can be closed');
      }
      const now = new Date();
      const updated = await tx.ticket.updateMany({
        where: {
          id,
          requesterId: user.id,
          status: 'RESOLVED',
          version: dto.version,
        },
        data: { status: 'CLOSED', closedAt: now, version: { increment: 1 } },
      });
      if (updated.count !== 1) {
        throw new ConflictException('Ticket changed. Reload and try again');
      }
      await tx.ticketActivity.create({
        data: {
          ticketId: id,
          actorId: user.id,
          type: 'STATUS',
          visibility: 'PUBLIC',
          fromStatus: 'RESOLVED',
          toStatus: 'CLOSED',
          createdAt: now,
        },
      });
    });
    return this.findById(user, id, 'requested');
  }

  async reopenRequesterTicket(
    user: AuthenticatedUser,
    id: string,
    dto: TicketActionDto,
    now = new Date(),
  ) {
    this.requireRequester(user);
    const cutoff = new Date(now.getTime() - 72 * 60 * 60 * 1000);
    await this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findFirst({
        where: { id, requesterId: user.id },
        select: { status: true, resolvedAt: true, assigneeId: true },
      });
      if (!ticket) throw new NotFoundException('Ticket not found');
      if (ticket.status !== 'RESOLVED') {
        throw new ConflictException('Only resolved tickets can be reopened');
      }
      if (
        !ticket.resolvedAt ||
        ticket.resolvedAt <= cutoff ||
        ticket.resolvedAt > now
      ) {
        throw new ConflictException(
          'The 72-hour reopen window has expired or is unavailable',
        );
      }
      const nextStatus: TicketStatus = ticket.assigneeId
        ? 'ASSIGNED'
        : 'TRIAGED';
      const updated = await tx.ticket.updateMany({
        where: {
          id,
          requesterId: user.id,
          status: 'RESOLVED',
          version: dto.version,
          resolvedAt: { gt: cutoff, lte: now },
        },
        data: {
          status: nextStatus,
          resolvedAt: null,
          closedAt: null,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException('Ticket changed. Reload and try again');
      }
      await tx.ticketActivity.create({
        data: {
          ticketId: id,
          actorId: user.id,
          type: 'STATUS',
          visibility: 'PUBLIC',
          fromStatus: 'RESOLVED',
          toStatus: nextStatus,
          content: dto.reason,
          createdAt: now,
        },
      });
    });
    return this.findById(user, id, 'requested');
  }

  async create(user: AuthenticatedUser, dto: CreateTicketDto) {
    if (!user.roles.includes('REQUESTER')) {
      throw new ForbiddenException('Ticket creation requires REQUESTER role');
    }
    const category = await this.prisma.category.findFirst({
      where: { id: dto.categoryId, active: true },
      select: { id: true },
    });
    if (!category) {
      throw new BadRequestException('Category is unavailable');
    }

    const impact = dto.impact as TicketImpact;
    const urgency = dto.urgency as TicketUrgency;
    const priority = this.calculatePriority(impact, urgency);

    return this.prisma.$transaction(async (tx) => {
      const policy = await tx.slaPolicy.findUnique({ where: { priority } });
      if (
        !policy?.active ||
        policy.responseMinutes <= 0 ||
        policy.resolutionMinutes <= 0
      ) {
        throw new ServiceUnavailableException(`No active SLA policy for ${priority}`);
      }
      const now = new Date();
      return tx.ticket.create({
        data: {
          code: `INC-${now.getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`,
          type: 'INCIDENT',
          title: dto.title,
          description: dto.description,
          categoryId: category.id,
          impact,
          urgency,
          priority,
          requesterId: user.id,
          createdAt: now,
          ticketSla: {
            create: {
              slaPolicyId: policy.id,
              policyRevision: policy.revision,
              responseTargetMinutes: policy.responseMinutes,
              resolutionTargetMinutes: policy.resolutionMinutes,
              responseDueAt: new Date(now.getTime() + policy.responseMinutes * 60_000),
              resolutionDueAt: new Date(now.getTime() + policy.resolutionMinutes * 60_000),
            },
          },
        },
        include: {
          category: true,
          requester: { select: { id: true, fullName: true, email: true } },
          assignee: { select: { id: true, fullName: true } },
        },
      });
    });
  }

  /* =========================================================================
     SUPERVISOR WORKFLOW, ASSIGNMENT, DASHBOARD & SLA FOUNDATION
  ========================================================================= */

  async listTechnicians(
    user: AuthenticatedUser,
  ): Promise<SupervisorTechnicianSummary[]> {
    this.requireSupervisor(user);
    const technicians = await this.prisma.user.findMany({
      where: {
        active: true,
        userRoles: {
          some: {
            role: { code: 'TECHNICIAN' },
          },
        },
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        assignedTickets: {
          select: { status: true },
        },
      },
      orderBy: { fullName: 'asc' },
    });

    return technicians.map((tech) => {
      let assignedCount = 0;
      let inProgressCount = 0;
      let waitingRequesterCount = 0;
      let resolvedCount = 0;
      let closedCount = 0;

      for (const ticket of tech.assignedTickets) {
        if (ticket.status === 'ASSIGNED') assignedCount++;
        else if (ticket.status === 'IN_PROGRESS') inProgressCount++;
        else if (ticket.status === 'WAITING_REQUESTER') waitingRequesterCount++;
        else if (ticket.status === 'RESOLVED') resolvedCount++;
        else if (ticket.status === 'CLOSED') closedCount++;
      }

      return {
        id: tech.id,
        fullName: tech.fullName,
        email: tech.email,
        activeAssignedCount:
          assignedCount + inProgressCount + waitingRequesterCount,
        assignedCount,
        inProgressCount,
        waitingRequesterCount,
        resolvedCount,
        closedCount,
      };
    });
  }

  async triageTicket(
    user: AuthenticatedUser,
    id: string,
    dto: TriageTicketDto,
    now = new Date(),
  ) {
    this.requireSupervisor(user);
    await this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findFirst({
        where: { id },
        select: {
          id: true,
          status: true,
          categoryId: true,
          impact: true,
          urgency: true,
          priority: true,
        },
      });
      if (!ticket) throw new NotFoundException('Ticket not found');
      if (ticket.status !== 'NEW') {
        throw new ConflictException('Only NEW tickets can be triaged');
      }

      let nextCategoryId = ticket.categoryId;
      if (dto.categoryId && dto.categoryId !== ticket.categoryId) {
        const category = await tx.category.findFirst({
          where: { id: dto.categoryId, active: true },
          select: { id: true },
        });
        if (!category) {
          throw new BadRequestException('Category is unavailable');
        }
        nextCategoryId = category.id;
      }

      const nextImpact = (dto.impact ?? ticket.impact) as TicketImpact;
      const nextUrgency = (dto.urgency ?? ticket.urgency) as TicketUrgency;
      const matrixPriority = this.calculatePriority(nextImpact, nextUrgency);
      const nextPriority = (dto.priority ?? matrixPriority) as TicketPriority;

      if (
        dto.priority &&
        dto.priority !== matrixPriority &&
        (!dto.reason || dto.reason.trim().length < 3)
      ) {
        throw new BadRequestException(
          'Priority override during triage requires a reason of at least 3 characters',
        );
      }

      const updated = await tx.ticket.updateMany({
        where: { id, status: 'NEW', version: dto.version },
        data: {
          status: 'TRIAGED',
          categoryId: nextCategoryId,
          impact: nextImpact,
          urgency: nextUrgency,
          priority: nextPriority,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException('Ticket changed. Reload and try again');
      }

      const auditDetails: string[] = [
        `Phân loại Ticket (Impact: ${nextImpact}, Urgency: ${nextUrgency} → Priority: ${nextPriority})`,
      ];
      if (dto.priority && dto.priority !== matrixPriority) {
        auditDetails.push(`Điều chỉnh từ ${matrixPriority} sang ${nextPriority}`);
      }
      if (dto.reason) {
        auditDetails.push(`Ghi chú: ${dto.reason}`);
      }

      await tx.ticketActivity.create({
        data: {
          ticketId: id,
          actorId: user.id,
          type: 'STATUS',
          visibility: 'PUBLIC',
          fromStatus: 'NEW',
          toStatus: 'TRIAGED',
          content: auditDetails.join(' · '),
          createdAt: now,
        },
      });
    });

    return this.findById(user, id);
  }

  async assignTicket(
    user: AuthenticatedUser,
    id: string,
    dto: AssignTicketDto,
    now = new Date(),
  ) {
    this.requireSupervisor(user);
    await this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findFirst({
        where: { id },
        select: {
          id: true,
          status: true,
          requesterId: true,
          assigneeId: true,
          assignee: { select: { id: true, fullName: true } },
        },
      });
      if (!ticket) throw new NotFoundException('Ticket not found');

      if (ticket.status === 'NEW') {
        throw new ConflictException('Ticket must be triaged before assignment');
      }
      if (['RESOLVED', 'CLOSED', 'REJECTED'].includes(ticket.status)) {
        throw new ConflictException(
          'Cannot assign a resolved, closed, or rejected ticket',
        );
      }
      if (dto.assigneeId === ticket.requesterId) {
        throw new BadRequestException(
          'Technician cannot be assigned to their own requested ticket',
        );
      }

      const technician = await tx.user.findFirst({
        where: {
          id: dto.assigneeId,
          active: true,
          userRoles: {
            some: {
              role: { code: 'TECHNICIAN' },
            },
          },
        },
        select: { id: true, fullName: true },
      });
      if (!technician) {
        throw new BadRequestException(
          'Selected assignee is not an active technician',
        );
      }

      const nextStatus: TicketStatus =
        ticket.status === 'TRIAGED' ? 'ASSIGNED' : ticket.status;

      const updated = await tx.ticket.updateMany({
        where: {
          id,
          status: ticket.status,
          version: dto.version,
        },
        data: {
          assigneeId: technician.id,
          status: nextStatus,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException('Ticket changed. Reload and try again');
      }

      const isReassign =
        ticket.assignee !== null && ticket.assignee.id !== technician.id;
      const baseNote = isReassign
        ? `Phân công lại kỹ thuật viên: ${ticket.assignee!.fullName} → ${technician.fullName}`
        : `Phân công kỹ thuật viên: ${technician.fullName}`;
      const content = dto.reason ? `${baseNote} · Lý do: ${dto.reason}` : baseNote;

      await tx.ticketActivity.create({
        data: {
          ticketId: id,
          actorId: user.id,
          type: 'STATUS',
          visibility: 'PUBLIC',
          fromStatus: ticket.status,
          toStatus: nextStatus,
          content,
          createdAt: now,
        },
      });
    });

    return this.findById(user, id);
  }

  async rejectTicket(
    user: AuthenticatedUser,
    id: string,
    dto: TicketActionDto,
    now = new Date(),
  ) {
    this.requireSupervisor(user);
    await this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findFirst({
        where: { id },
        select: { id: true, status: true },
      });
      if (!ticket) throw new NotFoundException('Ticket not found');

      if (ticket.status !== 'NEW' && ticket.status !== 'TRIAGED') {
        throw new ConflictException(
          'Only NEW or TRIAGED tickets can be rejected',
        );
      }

      const updated = await tx.ticket.updateMany({
        where: { id, status: ticket.status, version: dto.version },
        data: {
          status: 'REJECTED',
          closedAt: now,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException('Ticket changed. Reload and try again');
      }

      await tx.ticketActivity.create({
        data: {
          ticketId: id,
          actorId: user.id,
          type: 'STATUS',
          visibility: 'PUBLIC',
          fromStatus: ticket.status,
          toStatus: 'REJECTED',
          content: `Từ chối yêu cầu · Lý do: ${dto.reason}`,
          createdAt: now,
        },
      });
    });

    return this.findById(user, id);
  }

  async overridePriority(
    user: AuthenticatedUser,
    id: string,
    dto: OverridePriorityDto,
    now = new Date(),
  ) {
    this.requireSupervisor(user);
    await this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findFirst({
        where: { id },
        select: { id: true, status: true, priority: true },
      });
      if (!ticket) throw new NotFoundException('Ticket not found');

      if (ticket.status === 'CLOSED' || ticket.status === 'REJECTED') {
        throw new ConflictException(
          'Cannot override priority of a closed or rejected ticket',
        );
      }

      const nextPriority = dto.priority as TicketPriority;
      const updated = await tx.ticket.updateMany({
        where: { id, status: ticket.status, version: dto.version },
        data: {
          priority: nextPriority,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException('Ticket changed. Reload and try again');
      }

      await tx.ticketActivity.create({
        data: {
          ticketId: id,
          actorId: user.id,
          type: 'STATUS',
          visibility: 'PUBLIC',
          fromStatus: ticket.status,
          toStatus: ticket.status,
          content: `Điều chỉnh mức ưu tiên: ${ticket.priority} → ${nextPriority} · Lý do: ${dto.reason}`,
          createdAt: now,
        },
      });
    });

    return this.findById(user, id);
  }

  async getSupervisorTicketActivity(user: AuthenticatedUser, id: string) {
    this.requireSupervisor(user);
    const ticket = await this.prisma.ticket.findFirst({
      where: { id },
      select: { id: true },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    return this.prisma.ticketActivity.findMany({
      where: { ticketId: id },
      select: {
        id: true,
        type: true,
        visibility: true,
        content: true,
        fromStatus: true,
        toStatus: true,
        createdAt: true,
        actor: { select: { id: true, fullName: true } },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  async getTicketSla(
    user: AuthenticatedUser,
    id: string,
    now = new Date(),
  ): Promise<TicketSlaSnapshot> {
    this.requireTicketRole(user);
    const ticket = await this.prisma.ticket.findFirst({
      where: { id, AND: [this.accessScope(user)] },
      select: {
        id: true,
        priority: true,
        status: true,
        createdAt: true,
        resolvedAt: true,
        closedAt: true,
        ticketSla: true,
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    return computeTicketSla(
      ticket,
      this.requireSlaSnapshot(ticket.ticketSla),
      now,
    );
  }

  async getSupervisorDashboard(
    user: AuthenticatedUser,
    now = new Date(),
  ): Promise<SupervisorDashboardSummary> {
    this.requireSupervisor(user);
    const [tickets, workloadByTechnician] = await Promise.all([
      this.prisma.ticket.findMany({
        select: {
          id: true,
          assigneeId: true,
          priority: true,
          status: true,
          createdAt: true,
          resolvedAt: true,
          closedAt: true,
          ticketSla: true,
        },
      }),
      this.listTechnicians(user),
    ]);

    const byStatus: Record<TicketStatus, number> = {
      NEW: 0,
      TRIAGED: 0,
      ASSIGNED: 0,
      IN_PROGRESS: 0,
      WAITING_REQUESTER: 0,
      RESOLVED: 0,
      CLOSED: 0,
      REJECTED: 0,
    };

    const byPriority: Record<TicketPriority, number> = {
      P1: 0,
      P2: 0,
      P3: 0,
      P4: 0,
    };

    const sla = {
      onTrack: 0,
      atRisk: 0,
      breached: 0,
      met: 0,
      unknown: 0,
    };

    let unassignedCount = 0;
    let triageQueueCount = 0;

    for (const ticket of tickets) {
      byStatus[ticket.status]++;
      byPriority[ticket.priority]++;

      if (
        !ticket.assigneeId &&
        OPEN_TICKET_STATUSES.includes(ticket.status)
      ) {
        unassignedCount++;
      }
      if (ticket.status === 'NEW' || ticket.status === 'TRIAGED') {
        triageQueueCount++;
      }

      if (!this.hasSlaSnapshot(ticket.ticketSla)) {
        sla.unknown++;
        continue;
      }
      const slaSnap = computeTicketSla(ticket, ticket.ticketSla, now);

      if (slaSnap.overallStatus === 'BREACHED') sla.breached++;
      else if (slaSnap.overallStatus === 'AT_RISK') sla.atRisk++;
      else if (slaSnap.overallStatus === 'ON_TRACK') sla.onTrack++;
      else sla.met++;
    }

    return {
      totalTickets: tickets.length,
      unassignedCount,
      triageQueueCount,
      byStatus,
      byPriority,
      sla,
      workloadByTechnician,
    };
  }

  /**
   * Foundation for Week 5 SLA Background Worker: scans open tickets for SLA warnings (>=80%) or breaches (>100%).
   */
  async scanSlaCandidates(now = new Date()): Promise<TicketSlaSnapshot[]> {
    const openTickets = await this.prisma.ticket.findMany({
      where: { status: { in: OPEN_TICKET_STATUSES } },
      select: {
        id: true,
        priority: true,
        status: true,
        createdAt: true,
        resolvedAt: true,
        closedAt: true,
        ticketSla: true,
      },
    });

    const alerts: TicketSlaSnapshot[] = [];
    for (const ticket of openTickets) {
      if (!this.hasSlaSnapshot(ticket.ticketSla)) continue;
      const snap = computeTicketSla(ticket, ticket.ticketSla, now);
      if (
        snap.overallStatus === 'AT_RISK' ||
        snap.overallStatus === 'BREACHED'
      ) {
        alerts.push(snap);
      }
    }
    return alerts;
  }

  calculatePriority(
    impact: TicketImpact,
    urgency: TicketUrgency,
  ): TicketPriority {
    const matrix: Record<TicketImpact, Record<TicketUrgency, TicketPriority>> =
      {
        LOW: { LOW: 'P4', MEDIUM: 'P4', HIGH: 'P3' },
        MEDIUM: { LOW: 'P4', MEDIUM: 'P3', HIGH: 'P2' },
        HIGH: { LOW: 'P3', MEDIUM: 'P2', HIGH: 'P1' },
      };
    return matrix[impact][urgency];
  }

  private accessScope(user: AuthenticatedUser): Prisma.TicketWhereInput {
    if (user.roles.includes('SUPERVISOR')) return {};
    const scopes: Prisma.TicketWhereInput[] = [];
    if (user.roles.includes('REQUESTER')) scopes.push({ requesterId: user.id });
    if (user.roles.includes('TECHNICIAN')) scopes.push({ assigneeId: user.id });
    return scopes.length === 1 ? scopes[0] : { OR: scopes };
  }

  private async assertAssignedTicket(
    ticketStore: Prisma.TransactionClient['ticket'],
    user: AuthenticatedUser,
    id: string,
  ) {
    const ticket = await ticketStore.findFirst({
      where: { id, assigneeId: user.id },
      select: { id: true, status: true },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  private requireTicketRole(user: AuthenticatedUser): void {
    if (
      !user.roles.some((role) =>
        ['REQUESTER', 'TECHNICIAN', 'SUPERVISOR'].includes(role),
      )
    ) {
      throw new ForbiddenException('Ticket access requires a Ticket role');
    }
  }

  private requireRequester(user: AuthenticatedUser): void {
    if (!user.roles.includes('REQUESTER')) {
      throw new ForbiddenException('Requester scope requires REQUESTER role');
    }
  }

  private requireSupervisor(user: AuthenticatedUser): void {
    if (!user.roles.includes('SUPERVISOR')) {
      throw new ForbiddenException('Action requires SUPERVISOR role');
    }
  }

  private requireTechnician(user: AuthenticatedUser): void {
    if (!user.roles.includes('TECHNICIAN')) {
      throw new ForbiddenException('Technician scope requires TECHNICIAN role');
    }
  }

  private hasSlaSnapshot(sla: TicketSla | null): sla is TicketSla & PersistedSlaTarget {
    return sla?.responseTargetMinutes != null && sla.resolutionTargetMinutes != null;
  }

  private requireSlaSnapshot(sla: TicketSla | null): PersistedSlaTarget {
    if (!this.hasSlaSnapshot(sla)) {
      throw new ServiceUnavailableException('SLA snapshot unavailable for legacy ticket');
    }
    return sla;
  }
}
