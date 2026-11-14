import {
  BadRequestException,
  Injectable,
  NotFoundException,
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

@Injectable()
export class TicketsService {
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

  async findAll(user: AuthenticatedUser, query: TicketQueryDto) {
    const where: Prisma.TicketWhereInput = {};
    if (user.roles.includes('REQUESTER') && !this.hasInternalRole(user)) {
      where.requesterId = user.id;
    } else if (user.roles.includes('TECHNICIAN') && !this.hasManagerRole(user)) {
      where.assigneeId = user.id;
    }

    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.status) where.status = query.status as TicketStatus;
    if (query.priority) where.priority = query.priority as TicketPriority;
    if (query.search) {
      where.OR = [
        { code: { contains: query.search } },
        { title: { contains: query.search } },
        { description: { contains: query.search } },
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

  async findById(user: AuthenticatedUser, id: string) {
    const where: Prisma.TicketWhereInput = { id };
    if (user.roles.includes('REQUESTER') && !this.hasInternalRole(user)) {
      where.requesterId = user.id;
    } else if (user.roles.includes('TECHNICIAN') && !this.hasManagerRole(user)) {
      where.assigneeId = user.id;
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

  async create(user: AuthenticatedUser, dto: CreateTicketDto) {
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

  private hasManagerRole(user: AuthenticatedUser): boolean {
    return user.roles.includes('SUPERVISOR') || user.roles.includes('ADMIN');
  }

  private hasInternalRole(user: AuthenticatedUser): boolean {
    return user.roles.some((role) =>
      ['TECHNICIAN', 'SUPERVISOR', 'ADMIN'].includes(role),
    );
  }
}
