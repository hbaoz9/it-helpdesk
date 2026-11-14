import { BadRequestException } from '@nestjs/common';

export class CreateTicketDto {
  title!: string;
  description!: string;
  categoryId!: string;

  static validate(input: unknown): CreateTicketDto {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new BadRequestException('Invalid ticket payload');
    }

    const record = input as Record<string, unknown>;

    if (typeof record.title !== 'string' || record.title.trim().length === 0) {
      throw new BadRequestException('Ticket title is required');
    }

    if (
      typeof record.description !== 'string' ||
      record.description.trim().length === 0
    ) {
      throw new BadRequestException('Ticket description is required');
    }

    if (
      typeof record.categoryId !== 'string' ||
      record.categoryId.trim().length === 0
    ) {
      throw new BadRequestException('Ticket categoryId is required');
    }

    const dto = new CreateTicketDto();
    dto.title = record.title.trim();
    dto.description = record.description.trim();
    dto.categoryId = record.categoryId.trim();

    return dto;
  }
}
