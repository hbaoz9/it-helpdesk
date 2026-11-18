import { BadRequestException } from '@nestjs/common';
import { TicketActionDto } from './ticket-action.dto.js';

export class TicketCommentDto extends TicketActionDto {
  content!: string;

  static validate(input: unknown): TicketCommentDto {
    const action = TicketActionDto.validate(input);
    const record = input as Record<string, unknown>;
    if (typeof record.content !== 'string' || record.content.trim().length < 1 || record.content.trim().length > 2000) {
      throw new BadRequestException('Comment must contain 1 to 2000 characters');
    }
    const dto = new TicketCommentDto();
    dto.version = action.version;
    dto.content = record.content.trim();
    return dto;
  }
}
