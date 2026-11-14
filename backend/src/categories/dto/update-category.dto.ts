import { BadRequestException } from '@nestjs/common';

export class UpdateCategoryDto {
  name?: string;
  description?: string;
  isActive?: boolean;

  static validate(input: unknown): UpdateCategoryDto {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new BadRequestException('Invalid category update payload');
    }

    const record = input as Record<string, unknown>;
    const dto = new UpdateCategoryDto();

    if (record.name !== undefined) {
      if (typeof record.name !== 'string' || record.name.trim().length === 0) {
        throw new BadRequestException(
          'Category name must be a non-empty string',
        );
      }
      dto.name = record.name.trim();
    }

    if (record.description !== undefined) {
      if (typeof record.description !== 'string') {
        throw new BadRequestException('Category description must be a string');
      }
      dto.description = record.description.trim();
    }

    if (record.isActive !== undefined) {
      if (typeof record.isActive !== 'boolean') {
        throw new BadRequestException('Category isActive must be a boolean');
      }
      dto.isActive = record.isActive;
    }

    return dto;
  }
}
