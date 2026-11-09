import { BadRequestException } from '@nestjs/common';

export class CreateCategoryDto {
  name!: string;
  description?: string;
  isActive?: boolean;

  static validate(input: unknown): CreateCategoryDto {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new BadRequestException('Invalid category payload');
    }

    const record = input as Record<string, unknown>;

    if (typeof record.name !== 'string' || record.name.trim().length === 0) {
      throw new BadRequestException('Category name is required');
    }

    if (
      record.description !== undefined &&
      typeof record.description !== 'string'
    ) {
      throw new BadRequestException('Category description must be a string');
    }

    if (record.isActive !== undefined && typeof record.isActive !== 'boolean') {
      throw new BadRequestException('Category isActive must be a boolean');
    }

    const dto = new CreateCategoryDto();
    dto.name = record.name.trim();
    if (record.description !== undefined) {
      dto.description = record.description.trim();
    }
    if (record.isActive !== undefined) {
      dto.isActive = record.isActive;
    }

    return dto;
  }
}
