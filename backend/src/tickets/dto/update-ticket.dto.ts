import { BadRequestException } from '@nestjs/common';

export class UpdateTicketDto {
  title?: string;
  description?: string;
  categoryId?: string;
  priority?: string;

  static validate(input: unknown): UpdateTicketDto {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new BadRequestException('Invalid ticket update payload');
    }

    const record = input as Record<string, unknown>;
    const dto = new UpdateTicketDto();

    if (record.title !== undefined) {
      if (
        typeof record.title !== 'string' ||
        record.title.trim().length === 0
      ) {
        throw new BadRequestException(
          'Ticket title must be a non-empty string',
        );
      }
      dto.title = record.title.trim();
    }

    if (record.description !== undefined) {
      if (
        typeof record.description !== 'string' ||
        record.description.trim().length === 0
      ) {
        throw new BadRequestException(
          'Ticket description must be a non-empty string',
        );
      }
      dto.description = record.description.trim();
    }

    if (record.categoryId !== undefined) {
      if (
        typeof record.categoryId !== 'string' ||
        record.categoryId.trim().length === 0
      ) {
        throw new BadRequestException(
          'Ticket categoryId must be a non-empty string',
        );
      }
      dto.categoryId = record.categoryId.trim();
    }

    if (record.priority !== undefined) {
      if (
        typeof record.priority !== 'string' ||
        record.priority.trim().length === 0
      ) {
        throw new BadRequestException(
          'Ticket priority must be a non-empty string',
        );
      }
      dto.priority = record.priority.trim();
    }

    return dto;
  }
}
