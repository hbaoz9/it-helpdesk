import { BadRequestException } from '@nestjs/common';

export class CreateTicketDto {
  title!: string;
  description!: string;
  categoryId!: string;
  impact!: 'LOW' | 'MEDIUM' | 'HIGH';
  urgency!: 'LOW' | 'MEDIUM' | 'HIGH';

  static validate(input: unknown): CreateTicketDto {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new BadRequestException('Invalid ticket payload');
    }

    const record = input as Record<string, unknown>;

    if (
      typeof record.title !== 'string' ||
      record.title.trim().length === 0 ||
      record.title.trim().length > 150
    ) {
      throw new BadRequestException(
        'Ticket title must be between 1 and 150 characters',
      );
    }

    if (
      typeof record.description !== 'string' ||
      record.description.trim().length === 0 ||
      record.description.trim().length > 1500
    ) {
      throw new BadRequestException(
        'Ticket description must be between 1 and 1500 characters',
      );
    }

    if (
      typeof record.categoryId !== 'string' ||
      record.categoryId.trim().length === 0
    ) {
      throw new BadRequestException('Ticket categoryId is required');
    }
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        record.categoryId.trim(),
      )
    ) {
      throw new BadRequestException('Ticket categoryId must be a UUID');
    }

    if (!['LOW', 'MEDIUM', 'HIGH'].includes(String(record.impact))) {
      throw new BadRequestException('Ticket impact must be LOW, MEDIUM, or HIGH');
    }

    if (!['LOW', 'MEDIUM', 'HIGH'].includes(String(record.urgency))) {
      throw new BadRequestException(
        'Ticket urgency must be LOW, MEDIUM, or HIGH',
      );
    }

    const dto = new CreateTicketDto();
    dto.title = record.title.trim();
    dto.description = record.description.trim();
    dto.categoryId = record.categoryId.trim();
    dto.impact = record.impact as CreateTicketDto['impact'];
    dto.urgency = record.urgency as CreateTicketDto['urgency'];

    return dto;
  }
}
