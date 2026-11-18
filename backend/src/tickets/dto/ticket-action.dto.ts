import { BadRequestException } from '@nestjs/common';

export class TicketActionDto {
  version!: number;
  reason?: string;

  static validate(input: unknown, requireReason = false): TicketActionDto {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new BadRequestException('Invalid ticket action');
    }
    const record = input as Record<string, unknown>;
    if (typeof record.version !== 'number' || !Number.isSafeInteger(record.version) || record.version < 1) {
      throw new BadRequestException('Ticket version must be a positive integer');
    }
    const dto = new TicketActionDto();
    dto.version = record.version;
    if (requireReason) {
      if (typeof record.reason !== 'string' || record.reason.trim().length < 3 || record.reason.trim().length > 2000) {
        throw new BadRequestException('Reopen reason must contain 3 to 2000 characters');
      }
      dto.reason = record.reason.trim();
    }
    return dto;
  }
}
