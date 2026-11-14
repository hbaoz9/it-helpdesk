import { BadRequestException } from '@nestjs/common';

export class CategoryQueryDto {
  search?: string;
  isActive?: boolean;

  static validate(input: unknown): CategoryQueryDto {
    if (input === undefined || input === null) {
      return new CategoryQueryDto();
    }

    if (typeof input !== 'object' || Array.isArray(input)) {
      throw new BadRequestException('Invalid category query parameters');
    }

    const record = input as Record<string, unknown>;
    const dto = new CategoryQueryDto();

    if (record.search !== undefined) {
      if (typeof record.search !== 'string') {
        throw new BadRequestException(
          'Query parameter search must be a string',
        );
      }
      dto.search = record.search.trim();
    }

    if (record.isActive !== undefined) {
      if (record.isActive === 'true' || record.isActive === true) {
        dto.isActive = true;
      } else if (record.isActive === 'false' || record.isActive === false) {
        dto.isActive = false;
      } else {
        throw new BadRequestException(
          'Query parameter isActive must be boolean or "true"/"false"',
        );
      }
    }

    return dto;
  }
}
