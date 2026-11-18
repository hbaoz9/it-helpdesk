import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  Prisma,
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
      void this.closeExpiredTickets().catch(() => this.logger.warn('Ticket auto-close sweep failed'));
    }, 60_000);
    this.closeTimer.unref();
    void this.closeExpiredTickets().catch(() => this.logger.warn('Ticket auto-close sweep failed'));
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
              id: candidate.id, status: 'RESOLVED', version: candidate.version,
              resolvedAt: { lte: cutoff },
            },
            data: { status: 'CLOSED', closedAt: now, version: { increment: 1 } },
          });
          if (updated.count !== 1) return false;
          await tx.ticketActivity.create({
            data: {
              ticketId: candidate.id, type: 'STATUS', visibility: 'PUBLIC',
              fromStatus: 'RESOLVED', toStatus: 'CLOSED', createdAt: now,
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

  async findById(user: AuthenticatedUser, id: string, scope?: 'requested') {
    this.requireTicketRole(user);
    let where: Prisma.TicketWhereInput;
    if (scope === 'requested') {
      this.requireRequester(user);
      where = { id, requesterId: user.id };
    } else {
      where = { id, AND: [this.accessScope(user)] };
    }

    const ticket = await this.prisma.ticket.findFirst({
      where,
      include: {
        category: true,
        requester: { select: { id: true, fullName: true } },
        assignee: { select: { id: true, fullName: true } },
      },
    });
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }
    return ticket;
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

  async addRequesterComment(user: AuthenticatedUser, id: string, dto: TicketCommentDto) {
    this.requireRequester(user);
    const activity = await this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findFirst({
        where: { id, requesterId: user.id },
        select: { status: true },
      });
      if (!ticket) throw new NotFoundException('Ticket not found');
      const openStatuses: TicketStatus[] = ['NEW', 'TRIAGED', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_REQUESTER'];
      if (!openStatuses.includes(ticket.status)) {
        throw new ConflictException('This ticket is not open for comments');
      }
      const updated = await tx.ticket.updateMany({
        where: { id, requesterId: user.id, version: dto.version, status: { in: openStatuses } },
        data: { version: { increment: 1 } },
      });
      if (updated.count !== 1) throw new ConflictException('Ticket changed. Reload and try again');
      return tx.ticketActivity.create({
        data: { ticketId: id, actorId: user.id, type: 'COMMENT', visibility: 'PUBLIC', content: dto.content },
        select: {
          id: true, type: true, content: true, fromStatus: true, toStatus: true,
          createdAt: true, actor: { select: { id: true, fullName: true } },
        },
      });
    });
    return activity;
  }

  async closeRequesterTicket(user: AuthenticatedUser, id: string, dto: TicketActionDto) {
    this.requireRequester(user);
    await this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findFirst({
        where: { id, requesterId: user.id },
        select: { status: true },
      });
      if (!ticket) throw new NotFoundException('Ticket not found');
      if (ticket.status !== 'RESOLVED') throw new ConflictException('Only resolved tickets can be closed');
      const now = new Date();
      const updated = await tx.ticket.updateMany({
        where: { id, requesterId: user.id, status: 'RESOLVED', version: dto.version },
        data: { status: 'CLOSED', closedAt: now, version: { increment: 1 } },
      });
      if (updated.count !== 1) throw new ConflictException('Ticket changed. Reload and try again');
      await tx.ticketActivity.create({
        data: {
          ticketId: id, actorId: user.id, type: 'STATUS', visibility: 'PUBLIC',
          fromStatus: 'RESOLVED', toStatus: 'CLOSED', createdAt: now,
        },
      });
    });
    return this.findById(user, id, 'requested');
  }

  async reopenRequesterTicket(user: AuthenticatedUser, id: string, dto: TicketActionDto, now = new Date()) {
    this.requireRequester(user);
    const cutoff = new Date(now.getTime() - 72 * 60 * 60 * 1000);
    await this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findFirst({
        where: { id, requesterId: user.id },
        select: { status: true, resolvedAt: true, assigneeId: true },
      });
      if (!ticket) throw new NotFoundException('Ticket not found');
      if (ticket.status !== 'RESOLVED') throw new ConflictException('Only resolved tickets can be reopened');
      if (!ticket.resolvedAt || ticket.resolvedAt <= cutoff || ticket.resolvedAt > now) {
        throw new ConflictException('The 72-hour reopen window has expired or is unavailable');
      }
      const nextStatus: TicketStatus = ticket.assigneeId ? 'ASSIGNED' : 'TRIAGED';
      const updated = await tx.ticket.updateMany({
        where: {
          id, requesterId: user.id, status: 'RESOLVED', version: dto.version,
          resolvedAt: { gt: cutoff, lte: now },
        },
        data: {
          status: nextStatus, resolvedAt: null, closedAt: null,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) throw new ConflictException('Ticket changed. Reload and try again');
      await tx.ticketActivity.create({
        data: {
          ticketId: id, actorId: user.id, type: 'STATUS', visibility: 'PUBLIC',
          fromStatus: 'RESOLVED', toStatus: nextStatus,
          content: dto.reason, createdAt: now,
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

    return this.prisma.ticket.create({
      data: {
        code: `INC-${new Date().getFullYear()}-${randomUUID()
          .slice(0, 8)
          .toUpperCase()}`,
        type: 'INCIDENT',
        title: dto.title,
        description: dto.description,
        categoryId: category.id,
        impact,
        urgency,
        priority,
        requesterId: user.id,
      },
      include: {
        category: true,
        requester: { select: { id: true, fullName: true } },
        assignee: { select: { id: true, fullName: true } },
      },
    });
  }

  private calculatePriority(
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

  private requireTicketRole(user: AuthenticatedUser): void {
    if (!user.roles.some((role) =>
      ['REQUESTER', 'TECHNICIAN', 'SUPERVISOR'].includes(role),
    )) {
      throw new ForbiddenException('Ticket access requires a Ticket role');
    }
  }

  private requireRequester(user: AuthenticatedUser): void {
    if (!user.roles.includes('REQUESTER')) {
      throw new ForbiddenException('Requester scope requires REQUESTER role');
    }
  }
}
