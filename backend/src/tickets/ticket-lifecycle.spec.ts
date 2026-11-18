import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CategoriesService } from '../categories/categories.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TicketActionDto } from './dto/ticket-action.dto.js';
import { TicketCommentDto } from './dto/ticket-comment.dto.js';
import { TicketsService } from './tickets.service.js';

const requester = {
  id: 'requester-id', email: 'requester@example.com', fullName: 'Requester',
  roles: ['REQUESTER' as const],
};
const admin = {
  id: 'admin-id', email: 'admin@example.com', fullName: 'Admin',
  roles: ['ADMIN' as const],
};

function serviceWith(prisma: Record<string, unknown>): TicketsService {
  return new TicketsService(prisma as unknown as PrismaService, {} as CategoriesService);
}

describe('Requester Ticket lifecycle', () => {
  it('validates version and public comment text', () => {
    expect(TicketCommentDto.validate({ version: 2, content: '  Bổ sung thông tin  ' }))
      .toMatchObject({ version: 2, content: 'Bổ sung thông tin' });
    expect(() => TicketActionDto.validate({ version: 0 })).toThrow(BadRequestException);
    expect(() => TicketActionDto.validate({ version: 1, reason: '' }, true)).toThrow(BadRequestException);
    expect(() => TicketCommentDto.validate({ version: 1, content: '   ' })).toThrow(BadRequestException);
  });

  it('reads only public activity of an owned Ticket', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: 'ticket-id' });
    const findMany = vi.fn().mockResolvedValue([]);
    const service = serviceWith({ ticket: { findFirst }, ticketActivity: { findMany } });
    await expect(service.getRequesterActivity(requester, 'ticket-id')).resolves.toEqual([]);
    expect(findFirst).toHaveBeenCalledWith({ where: { id: 'ticket-id', requesterId: requester.id }, select: { id: true } });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { ticketId: 'ticket-id', visibility: 'PUBLIC' },
    }));
    await expect(service.getRequesterActivity(admin, 'ticket-id')).rejects.toThrow(ForbiddenException);
    findFirst.mockResolvedValueOnce(null);
    await expect(service.getRequesterActivity(requester, 'other-id')).rejects.toThrow(NotFoundException);
  });

  it('adds a public comment when waiting for Requester, with a version check', async () => {
    const findFirst = vi.fn().mockResolvedValue({ status: 'WAITING_REQUESTER' });
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const create = vi.fn().mockResolvedValue({ id: 'activity-id' });
    const tx = { ticket: { findFirst, updateMany }, ticketActivity: { create } };
    const service = serviceWith({ $transaction: vi.fn((callback) => callback(tx)) });
    const dto = TicketCommentDto.validate({ version: 3, content: 'Đã thử kết nối lại mạng.' });
    await expect(service.addRequesterComment(requester, 'ticket-id', dto)).resolves.toEqual({ id: 'activity-id' });
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ requesterId: requester.id, version: 3, status: { in: expect.arrayContaining(['WAITING_REQUESTER']) } }),
    }));
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ actorId: requester.id, type: 'COMMENT', visibility: 'PUBLIC', content: dto.content }),
    }));
    updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.addRequesterComment(requester, 'ticket-id', dto)).rejects.toThrow(ConflictException);
  });

  it('rejects comments on unowned or closed Tickets', async () => {
    const findFirst = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ status: 'CLOSED' });
    const create = vi.fn();
    const tx = { ticket: { findFirst, updateMany: vi.fn() }, ticketActivity: { create } };
    const service = serviceWith({ $transaction: vi.fn((callback) => callback(tx)) });
    const dto = TicketCommentDto.validate({ version: 1, content: 'Thông tin thêm' });
    await expect(service.addRequesterComment(requester, 'ticket-id', dto)).rejects.toThrow(NotFoundException);
    await expect(service.addRequesterComment(requester, 'ticket-id', dto)).rejects.toThrow(ConflictException);
    expect(create).not.toHaveBeenCalled();
  });

  it('closes only an owned RESOLVED Ticket once', async () => {
    const findFirst = vi.fn().mockResolvedValue({ status: 'RESOLVED' });
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const create = vi.fn();
    const tx = { ticket: { findFirst, updateMany }, ticketActivity: { create } };
    const service = serviceWith({
      $transaction: vi.fn((callback) => callback(tx)),
      ticket: { findFirst: vi.fn().mockResolvedValue({ id: 'ticket-id' }) },
    });
    await expect(service.closeRequesterTicket(requester, 'ticket-id', TicketActionDto.validate({ version: 4 })))
      .resolves.toEqual({ id: 'ticket-id' });
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'ticket-id', requesterId: requester.id, status: 'RESOLVED', version: 4 },
      data: expect.objectContaining({ status: 'CLOSED' }),
    }));
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ fromStatus: 'RESOLVED', toStatus: 'CLOSED', visibility: 'PUBLIC' }),
    }));
    updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.closeRequesterTicket(requester, 'ticket-id', TicketActionDto.validate({ version: 4 })))
      .rejects.toThrow(ConflictException);
  });

  it('automatically closes expired RESOLVED Tickets with a compare-and-swap', async () => {
    const now = new Date('2026-11-18T12:00:00.000Z');
    const findMany = vi.fn().mockResolvedValue([{ id: 'expired-id', version: 7 }]);
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const create = vi.fn();
    const tx = { ticket: { updateMany }, ticketActivity: { create } };
    const service = serviceWith({ ticket: { findMany }, $transaction: vi.fn((callback) => callback(tx)) });
    await expect(service.closeExpiredTickets(now)).resolves.toBe(1);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: 'RESOLVED', resolvedAt: { lte: new Date('2026-11-15T12:00:00.000Z') } },
    }));
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'expired-id', version: 7, status: 'RESOLVED' }),
      data: expect.objectContaining({ status: 'CLOSED', closedAt: now }),
    }));
    expect(create).toHaveBeenCalledTimes(1);
    updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.closeExpiredTickets(now)).resolves.toBe(0);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('reopens an owned Ticket inside 72 hours and returns it to the assigned Technician queue', async () => {
    const now = new Date('2026-11-18T12:00:00.000Z');
    const findFirst = vi.fn().mockResolvedValue({
      status: 'RESOLVED', resolvedAt: new Date('2026-11-15T12:00:00.001Z'), assigneeId: 'tech-id',
    });
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const create = vi.fn();
    const tx = { ticket: { findFirst, updateMany }, ticketActivity: { create } };
    const service = serviceWith({
      $transaction: vi.fn((callback) => callback(tx)),
      ticket: { findFirst: vi.fn().mockResolvedValue({ status: 'ASSIGNED' }) },
    });
    const dto = TicketActionDto.validate({ version: 5, reason: 'Sự cố vẫn còn' }, true);
    await expect(service.reopenRequesterTicket(requester, 'ticket-id', dto, now))
      .resolves.toEqual({ status: 'ASSIGNED' });
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'ticket-id', requesterId: requester.id, version: 5, status: 'RESOLVED',
        resolvedAt: { gt: new Date('2026-11-15T12:00:00.000Z'), lte: now },
      }),
      data: expect.objectContaining({ status: 'ASSIGNED', resolvedAt: null, closedAt: null }),
    }));
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ actorId: requester.id, toStatus: 'ASSIGNED', content: dto.reason }),
    }));
    updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.reopenRequesterTicket(requester, 'ticket-id', dto, now))
      .rejects.toThrow(ConflictException);
  });

  it('rejects reopening at the 72-hour boundary, wrong status, and non-owners', async () => {
    const now = new Date('2026-11-18T12:00:00.000Z');
    const findFirst = vi.fn()
      .mockResolvedValueOnce({ status: 'RESOLVED', resolvedAt: new Date('2026-11-15T12:00:00.000Z'), assigneeId: null })
      .mockResolvedValueOnce({ status: 'CLOSED', resolvedAt: new Date('2026-11-18T11:00:00.000Z'), assigneeId: null })
      .mockResolvedValueOnce(null);
    const updateMany = vi.fn();
    const tx = { ticket: { findFirst, updateMany }, ticketActivity: { create: vi.fn() } };
    const service = serviceWith({ $transaction: vi.fn((callback) => callback(tx)) });
    const dto = TicketActionDto.validate({ version: 1, reason: 'Vẫn còn lỗi' }, true);
    await expect(service.reopenRequesterTicket(requester, 'ticket-id', dto, now)).rejects.toThrow(ConflictException);
    await expect(service.reopenRequesterTicket(requester, 'ticket-id', dto, now)).rejects.toThrow(ConflictException);
    await expect(service.reopenRequesterTicket(requester, 'ticket-id', dto, now)).rejects.toThrow(NotFoundException);
    await expect(service.reopenRequesterTicket(admin, 'ticket-id', dto, now)).rejects.toThrow(ForbiddenException);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('routes an unassigned reopened Ticket back to triage', async () => {
    const now = new Date('2026-11-18T12:00:00.000Z');
    const tx = {
      ticket: {
        findFirst: vi.fn().mockResolvedValue({ status: 'RESOLVED', resolvedAt: new Date('2026-11-18T11:00:00.000Z'), assigneeId: null }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      ticketActivity: { create: vi.fn() },
    };
    const service = serviceWith({
      $transaction: vi.fn((callback) => callback(tx)),
      ticket: { findFirst: vi.fn().mockResolvedValue({ status: 'TRIAGED' }) },
    });
    await service.reopenRequesterTicket(requester, 'ticket-id', TicketActionDto.validate({ version: 2, reason: 'Vẫn còn lỗi' }, true), now);
    expect(tx.ticket.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'TRIAGED' }),
    }));
  });

  it('continues the auto-close sweep after one Ticket fails', async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: 'failed', version: 1 }, { id: 'next', version: 1 }]);
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const tx = { ticket: { updateMany }, ticketActivity: { create: vi.fn() } };
    const transaction = vi.fn().mockRejectedValueOnce(new Error('Database timeout'))
      .mockImplementation((callback) => callback(tx));
    const service = serviceWith({ ticket: { findMany }, $transaction: transaction });
    await expect(service.closeExpiredTickets(new Date('2026-11-18T12:00:00.000Z'))).resolves.toBe(1);
    expect(transaction).toHaveBeenCalledTimes(2);
  });
});
