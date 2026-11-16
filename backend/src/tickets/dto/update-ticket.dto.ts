import { BadRequestException } from '@nestjs/common';

export class UpdateTicketDto {
  title?: string;
  description?: string;
  categoryId?: string;

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
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          record.categoryId.trim(),
        )
      ) {
        throw new BadRequestException(
          'Ticket categoryId must be a UUID',
        );
      }
      dto.categoryId = record.categoryId.trim();
    }

    return dto;
  }
}
