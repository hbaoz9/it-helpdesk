import { BadRequestException } from '@nestjs/common';

export class TicketQueryDto {
  categoryId?: string;
  status?: string;
  priority?: string;
  search?: string;
  page?: number;
  limit?: number;

  static validate(input: unknown): TicketQueryDto {
    if (input === undefined || input === null) {
      return new TicketQueryDto();
    }

    if (typeof input !== 'object' || Array.isArray(input)) {
      throw new BadRequestException('Invalid ticket query parameters');
    }

    const record = input as Record<string, unknown>;
    const dto = new TicketQueryDto();

    if (record.categoryId !== undefined) {
      if (
        typeof record.categoryId !== 'string' ||
        record.categoryId.trim().length === 0
      ) {
        throw new BadRequestException(
          'Query parameter categoryId must be a non-empty string',
        );
      }
      dto.categoryId = record.categoryId.trim();
    }

    if (record.status !== undefined) {
      if (
        typeof record.status !== 'string' ||
        record.status.trim().length === 0
      ) {
        throw new BadRequestException(
          'Query parameter status must be a non-empty string',
        );
      }
      dto.status = record.status.trim();
    }

    if (record.priority !== undefined) {
      if (
        typeof record.priority !== 'string' ||
        record.priority.trim().length === 0
      ) {
        throw new BadRequestException(
          'Query parameter priority must be a non-empty string',
        );
      }
      dto.priority = record.priority.trim();
    }

    if (record.search !== undefined) {
      if (typeof record.search !== 'string') {
        throw new BadRequestException(
          'Query parameter search must be a string',
        );
      }
      dto.search = record.search.trim();
    }

    if (record.page !== undefined) {
      const page = Number(record.page);
      if (!Number.isInteger(page) || page < 1) {
        throw new BadRequestException(
          'Query parameter page must be a positive integer',
        );
      }
      dto.page = page;
    }

    if (record.limit !== undefined) {
      const limit = Number(record.limit);
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
        throw new BadRequestException(
          'Query parameter limit must be an integer between 1 and 100',
        );
      }
      dto.limit = limit;
    }

    return dto;
  }
}
