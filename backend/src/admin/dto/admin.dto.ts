import { BadRequestException } from '@nestjs/common';
import type { RoleCode } from '../../auth/auth.types.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_ROLES: ReadonlyArray<RoleCode> = [
  'REQUESTER',
  'TECHNICIAN',
  'SUPERVISOR',
  'ADMIN',
];

function parseBooleanQuery(value: unknown, fieldName: string): boolean {
  if (value === true || value === 'true') {
    return true;
  }
  if (value === false || value === 'false') {
    return false;
  }
  throw new BadRequestException(
    `Query parameter ${fieldName} must be boolean or "true"/"false"`,
  );
}

function validateRolesArray(input: unknown): RoleCode[] {
  if (!Array.isArray(input) || input.length === 0) {
    throw new BadRequestException('At least one valid role is required');
  }

  const normalized: RoleCode[] = [];
  for (const item of input) {
    if (
      typeof item !== 'string' ||
      !VALID_ROLES.includes(item as RoleCode)
    ) {
      throw new BadRequestException(
        `Invalid role. Allowed roles: ${VALID_ROLES.join(', ')}`,
      );
    }
    const code = item as RoleCode;
    if (!normalized.includes(code)) {
      normalized.push(code);
    }
  }

  return normalized;
}

export class AdminUsersQueryDto {
  search?: string;
  role?: RoleCode;
  active?: boolean;

  static validate(input: unknown): AdminUsersQueryDto {
    if (input === undefined || input === null) {
      return new AdminUsersQueryDto();
    }

    if (typeof input !== 'object' || Array.isArray(input)) {
      throw new BadRequestException('Invalid user query parameters');
    }

    const record = input as Record<string, unknown>;
    const dto = new AdminUsersQueryDto();

    if (record.search !== undefined) {
      if (typeof record.search !== 'string') {
        throw new BadRequestException('Query parameter search must be a string');
      }
      const trimmed = record.search.trim();
      if (trimmed.length > 0) {
        dto.search = trimmed;
      }
    }

    if (record.role !== undefined && record.role !== '') {
      if (
        typeof record.role !== 'string' ||
        !VALID_ROLES.includes(record.role as RoleCode)
      ) {
        throw new BadRequestException('Query parameter role is invalid');
      }
      dto.role = record.role as RoleCode;
    }

    if (record.active !== undefined && record.active !== '') {
      dto.active = parseBooleanQuery(record.active, 'active');
    }

    return dto;
  }
}

export class CreateAdminUserDto {
  email!: string;
  fullName!: string;
  password!: string;
  roles!: RoleCode[];
  active!: boolean;

  static validate(input: unknown): CreateAdminUserDto {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new BadRequestException('Invalid user creation payload');
    }

    const record = input as Record<string, unknown>;

    if (
      typeof record.email !== 'string' ||
      !EMAIL_REGEX.test(record.email.trim())
    ) {
      throw new BadRequestException('A valid email is required');
    }

    if (
      typeof record.fullName !== 'string' ||
      record.fullName.trim().length === 0 ||
      record.fullName.trim().length > 120
    ) {
      throw new BadRequestException(
        'Full name must be between 1 and 120 characters',
      );
    }

    if (
      typeof record.password !== 'string' ||
      record.password.length < 12 ||
      record.password.length > 128
    ) {
      throw new BadRequestException(
        'Password must be between 12 and 128 characters',
      );
    }

    const roles = validateRolesArray(record.roles);

    if (record.active !== undefined && typeof record.active !== 'boolean') {
      throw new BadRequestException('Field active must be a boolean');
    }

    const dto = new CreateAdminUserDto();
    dto.email = record.email.trim().toLowerCase();
    dto.fullName = record.fullName.trim();
    dto.password = record.password;
    dto.roles = roles;
    dto.active = record.active ?? true;
    return dto;
  }
}

export class UpdateAdminUserDto {
  fullName?: string;
  roles?: RoleCode[];
  active?: boolean;
  password?: string;

  static validate(input: unknown): UpdateAdminUserDto {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new BadRequestException('Invalid user update payload');
    }

    const record = input as Record<string, unknown>;
    const dto = new UpdateAdminUserDto();
    let hasField = false;

    if (record.fullName !== undefined) {
      if (
        typeof record.fullName !== 'string' ||
        record.fullName.trim().length === 0 ||
        record.fullName.trim().length > 120
      ) {
        throw new BadRequestException(
          'Full name must be between 1 and 120 characters',
        );
      }
      dto.fullName = record.fullName.trim();
      hasField = true;
    }

    if (record.roles !== undefined) {
      dto.roles = validateRolesArray(record.roles);
      hasField = true;
    }

    if (record.active !== undefined) {
      if (typeof record.active !== 'boolean') {
        throw new BadRequestException('Field active must be a boolean');
      }
      dto.active = record.active;
      hasField = true;
    }

    if (record.password !== undefined && record.password !== '') {
      if (
        typeof record.password !== 'string' ||
        record.password.length < 12 ||
        record.password.length > 128
      ) {
        throw new BadRequestException(
          'Password must be between 12 and 128 characters',
        );
      }
      dto.password = record.password;
      hasField = true;
    }

    if (!hasField) {
      throw new BadRequestException('At least one field must be updated');
    }

    return dto;
  }
}

export class AdminCategoriesQueryDto {
  search?: string;
  active?: boolean;

  static validate(input: unknown): AdminCategoriesQueryDto {
    if (input === undefined || input === null) {
      return new AdminCategoriesQueryDto();
    }

    if (typeof input !== 'object' || Array.isArray(input)) {
      throw new BadRequestException('Invalid category query parameters');
    }

    const record = input as Record<string, unknown>;
    const dto = new AdminCategoriesQueryDto();

    if (record.search !== undefined) {
      if (typeof record.search !== 'string') {
        throw new BadRequestException('Query parameter search must be a string');
      }
      const trimmed = record.search.trim();
      if (trimmed.length > 0) {
        dto.search = trimmed;
      }
    }

    if (record.active !== undefined && record.active !== '') {
      dto.active = parseBooleanQuery(record.active, 'active');
    }

    return dto;
  }
}

export class CreateAdminCategoryDto {
  name!: string;
  active!: boolean;

  static validate(input: unknown): CreateAdminCategoryDto {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new BadRequestException('Invalid category payload');
    }

    const record = input as Record<string, unknown>;
    if (
      typeof record.name !== 'string' ||
      record.name.trim().length === 0 ||
      record.name.trim().length > 120
    ) {
      throw new BadRequestException(
        'Category name must be between 1 and 120 characters',
      );
    }

    if (record.active !== undefined && typeof record.active !== 'boolean') {
      throw new BadRequestException('Category active must be a boolean');
    }

    const dto = new CreateAdminCategoryDto();
    dto.name = record.name.trim();
    dto.active = record.active ?? true;
    return dto;
  }
}

export class UpdateAdminCategoryDto {
  name?: string;
  active?: boolean;

  static validate(input: unknown): UpdateAdminCategoryDto {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new BadRequestException('Invalid category update payload');
    }

    const record = input as Record<string, unknown>;
    const dto = new UpdateAdminCategoryDto();
    let hasField = false;

    if (record.name !== undefined) {
      if (
        typeof record.name !== 'string' ||
        record.name.trim().length === 0 ||
        record.name.trim().length > 120
      ) {
        throw new BadRequestException(
          'Category name must be between 1 and 120 characters',
        );
      }
      dto.name = record.name.trim();
      hasField = true;
    }

    if (record.active !== undefined) {
      if (typeof record.active !== 'boolean') {
        throw new BadRequestException('Category active must be a boolean');
      }
      dto.active = record.active;
      hasField = true;
    }

    if (!hasField) {
      throw new BadRequestException('At least one category field is required');
    }

    return dto;
  }
}

export class UpdateSlaPolicyDto {
  responseMinutes!: number;
  resolutionMinutes!: number;
  reason?: string;

  static validate(input: unknown): UpdateSlaPolicyDto {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new BadRequestException('Invalid SLA policy update payload');
    }

    const record = input as Record<string, unknown>;
    const responseMinutes = Number(record.responseMinutes);
    const resolutionMinutes = Number(record.resolutionMinutes);

    if (
      !Number.isInteger(responseMinutes) ||
      responseMinutes < 1 ||
      responseMinutes > 10080
    ) {
      throw new BadRequestException(
        'responseMinutes must be an integer between 1 and 10080',
      );
    }

    if (
      !Number.isInteger(resolutionMinutes) ||
      resolutionMinutes < 1 ||
      resolutionMinutes > 43200
    ) {
      throw new BadRequestException(
        'resolutionMinutes must be an integer between 1 and 43200',
      );
    }

    if (resolutionMinutes < responseMinutes) {
      throw new BadRequestException(
        'resolutionMinutes must be greater than or equal to responseMinutes',
      );
    }

    const dto = new UpdateSlaPolicyDto();
    dto.responseMinutes = responseMinutes;
    dto.resolutionMinutes = resolutionMinutes;

    if (record.reason !== undefined) {
      if (typeof record.reason !== 'string') {
        throw new BadRequestException('reason must be a string');
      }
      const trimmed = record.reason.trim();
      if (trimmed.length > 0) {
        dto.reason = trimmed;
      }
    }

    return dto;
  }
}
