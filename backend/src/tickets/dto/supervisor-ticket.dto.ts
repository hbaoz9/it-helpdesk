import { BadRequestException } from '@nestjs/common';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ImpactValue = 'LOW' | 'MEDIUM' | 'HIGH';
export type UrgencyValue = 'LOW' | 'MEDIUM' | 'HIGH';
export type PriorityValue = 'P1' | 'P2' | 'P3' | 'P4';

function parseVersion(value: unknown): number {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < 1
  ) {
    throw new BadRequestException('Ticket version must be a positive integer');
  }
  return value;
}

export class TriageTicketDto {
  version!: number;
  categoryId?: string;
  impact?: ImpactValue;
  urgency?: UrgencyValue;
  priority?: PriorityValue;
  reason?: string;

  static validate(input: unknown): TriageTicketDto {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new BadRequestException('Invalid triage payload');
    }
    const record = input as Record<string, unknown>;
    const dto = new TriageTicketDto();
    dto.version = parseVersion(record.version);

    if (record.categoryId !== undefined) {
      if (
        typeof record.categoryId !== 'string' ||
        !UUID_REGEX.test(record.categoryId.trim())
      ) {
        throw new BadRequestException('Ticket categoryId must be a UUID');
      }
      dto.categoryId = record.categoryId.trim();
    }

    if (record.impact !== undefined) {
      if (
        typeof record.impact !== 'string' ||
        !['LOW', 'MEDIUM', 'HIGH'].includes(record.impact)
      ) {
        throw new BadRequestException(
          'Ticket impact must be LOW, MEDIUM, or HIGH',
        );
      }
      dto.impact = record.impact as ImpactValue;
    }

    if (record.urgency !== undefined) {
      if (
        typeof record.urgency !== 'string' ||
        !['LOW', 'MEDIUM', 'HIGH'].includes(record.urgency)
      ) {
        throw new BadRequestException(
          'Ticket urgency must be LOW, MEDIUM, or HIGH',
        );
      }
      dto.urgency = record.urgency as UrgencyValue;
    }

    if (record.priority !== undefined) {
      if (
        typeof record.priority !== 'string' ||
        !['P1', 'P2', 'P3', 'P4'].includes(record.priority)
      ) {
        throw new BadRequestException(
          'Ticket priority must be P1, P2, P3, or P4',
        );
      }
      dto.priority = record.priority as PriorityValue;
    }

    if (record.reason !== undefined && record.reason !== null) {
      if (
        typeof record.reason !== 'string' ||
        record.reason.trim().length > 2000
      ) {
        throw new BadRequestException(
          'Triage note must not exceed 2000 characters',
        );
      }
      const trimmed = record.reason.trim();
      if (trimmed.length > 0) {
        dto.reason = trimmed;
      }
    }

    return dto;
  }
}

export class AssignTicketDto {
  version!: number;
  assigneeId!: string;
  reason?: string;

  static validate(input: unknown): AssignTicketDto {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new BadRequestException('Invalid assignment payload');
    }
    const record = input as Record<string, unknown>;
    const dto = new AssignTicketDto();
    dto.version = parseVersion(record.version);

    if (
      typeof record.assigneeId !== 'string' ||
      !UUID_REGEX.test(record.assigneeId.trim())
    ) {
      throw new BadRequestException('Ticket assigneeId must be a valid UUID');
    }
    dto.assigneeId = record.assigneeId.trim();

    if (record.reason !== undefined && record.reason !== null) {
      if (
        typeof record.reason !== 'string' ||
        record.reason.trim().length > 2000
      ) {
        throw new BadRequestException(
          'Assignment reason must not exceed 2000 characters',
        );
      }
      const trimmed = record.reason.trim();
      if (trimmed.length > 0) {
        dto.reason = trimmed;
      }
    }

    return dto;
  }
}

export class OverridePriorityDto {
  version!: number;
  priority!: PriorityValue;
  reason!: string;

  static validate(input: unknown): OverridePriorityDto {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new BadRequestException('Invalid priority override payload');
    }
    const record = input as Record<string, unknown>;
    const dto = new OverridePriorityDto();
    dto.version = parseVersion(record.version);

    if (
      typeof record.priority !== 'string' ||
      !['P1', 'P2', 'P3', 'P4'].includes(record.priority)
    ) {
      throw new BadRequestException(
        'Ticket priority must be P1, P2, P3, or P4',
      );
    }
    dto.priority = record.priority as PriorityValue;

    if (
      typeof record.reason !== 'string' ||
      record.reason.trim().length < 3 ||
      record.reason.trim().length > 2000
    ) {
      throw new BadRequestException(
        'Priority override reason must contain 3 to 2000 characters',
      );
    }
    dto.reason = record.reason.trim();

    return dto;
  }
}
