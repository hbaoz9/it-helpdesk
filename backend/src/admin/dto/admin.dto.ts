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

const VALID_VERIFICATION_STATUSES = ['PENDING', 'VERIFIED', 'REVOKED'] as const;
export type DeviceVerificationStatusInput =
  (typeof VALID_VERIFICATION_STATUSES)[number];

export class AdminDevicesQueryDto {
  search?: string;
  active?: boolean;
  verificationStatus?: DeviceVerificationStatusInput;

  static validate(input: unknown): AdminDevicesQueryDto {
    if (input === undefined || input === null) {
      return new AdminDevicesQueryDto();
    }

    if (typeof input !== 'object' || Array.isArray(input)) {
      throw new BadRequestException('Invalid device query parameters');
    }

    const record = input as Record<string, unknown>;
    const dto = new AdminDevicesQueryDto();

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

    if (
      record.verificationStatus !== undefined &&
      record.verificationStatus !== ''
    ) {
      if (
        typeof record.verificationStatus !== 'string' ||
        !VALID_VERIFICATION_STATUSES.includes(
          record.verificationStatus as DeviceVerificationStatusInput,
        )
      ) {
        throw new BadRequestException(
          'Query parameter verificationStatus must be PENDING, VERIFIED, or REVOKED',
        );
      }
      dto.verificationStatus =
        record.verificationStatus as DeviceVerificationStatusInput;
    }

    return dto;
  }
}

export class UpdateAdminDeviceDto {
  label?: string;
  active?: boolean;
  verificationStatus?: DeviceVerificationStatusInput;
  observedRustdeskId?: string;
  verificationMethod?: 'IN_PERSON';
  reason?: string;

  static validate(input: unknown): UpdateAdminDeviceDto {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new BadRequestException('Invalid admin device update payload');
    }

    const record = input as Record<string, unknown>;
    const dto = new UpdateAdminDeviceDto();
    let hasField = false;

    if (record.label !== undefined) {
      if (
        typeof record.label !== 'string' ||
        record.label.trim().length < 2 ||
        record.label.trim().length > 120
      ) {
        throw new BadRequestException(
          'Device label must be between 2 and 120 characters',
        );
      }
      dto.label = record.label.trim();
      hasField = true;
    }

    if (record.active !== undefined) {
      if (typeof record.active !== 'boolean') {
        throw new BadRequestException('active must be a boolean');
      }
      dto.active = record.active;
      hasField = true;
    }

    if (record.verificationStatus !== undefined) {
      if (
        typeof record.verificationStatus !== 'string' ||
        !VALID_VERIFICATION_STATUSES.includes(
          record.verificationStatus as DeviceVerificationStatusInput,
        )
      ) {
        throw new BadRequestException(
          'verificationStatus must be PENDING, VERIFIED, or REVOKED',
        );
      }
      dto.verificationStatus =
        record.verificationStatus as DeviceVerificationStatusInput;
      hasField = true;
    }

    if (record.reason !== undefined && record.reason !== null) {
      if (
        typeof record.reason !== 'string' ||
        record.reason.trim().length > 500
      ) {
        throw new BadRequestException('reason must not exceed 500 characters');
      }
      const trimmed = record.reason.trim();
      if (trimmed.length > 0) {
        dto.reason = trimmed;
      }
    }

    if (dto.verificationStatus === 'VERIFIED') {
      if (record.verificationMethod !== 'IN_PERSON') {
        throw new BadRequestException('In-person verification is required');
      }
      if (typeof record.observedRustdeskId !== 'string') {
        throw new BadRequestException('Observed RustDesk ID is required');
      }
      dto.observedRustdeskId = record.observedRustdeskId.replace(/\s+/g, '');
      dto.verificationMethod = 'IN_PERSON';
      if (!dto.reason || dto.reason.length < 20) {
        throw new BadRequestException('Verification evidence must be at least 20 characters');
      }
    }

    if (!hasField) {
      throw new BadRequestException('At least one device field is required');
    }

    return dto;
  }
}

export class UpdateRustdeskConfigDto {
  idServerHost!: string;
  relayServerHost?: string | null;
  publicKey?: string | null;
  approvalTtlMinutes!: number;
  clientGuideUrl?: string | null;
  enabled!: boolean;
  reason?: string;

  static validate(input: unknown): UpdateRustdeskConfigDto {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new BadRequestException('Invalid RustDesk server config payload');
    }

    const record = input as Record<string, unknown>;
    if (
      typeof record.idServerHost !== 'string' ||
      record.idServerHost.trim().length < 3 ||
      record.idServerHost.trim().length > 255
    ) {
      throw new BadRequestException(
        'idServerHost must be between 3 and 255 characters',
      );
    }

    const approvalTtlMinutes = Number(record.approvalTtlMinutes ?? 15);
    if (
      !Number.isInteger(approvalTtlMinutes) ||
      approvalTtlMinutes < 1 ||
      approvalTtlMinutes > 120
    ) {
      throw new BadRequestException(
        'approvalTtlMinutes must be an integer between 1 and 120',
      );
    }

    if (record.enabled !== undefined && typeof record.enabled !== 'boolean') {
      throw new BadRequestException('enabled must be a boolean');
    }

    const dto = new UpdateRustdeskConfigDto();
    dto.idServerHost = record.idServerHost.trim();
    dto.approvalTtlMinutes = approvalTtlMinutes;
    dto.enabled = (record.enabled as boolean | undefined) ?? false;

    if (record.relayServerHost !== undefined) {
      if (record.relayServerHost === null || record.relayServerHost === '') {
        dto.relayServerHost = null;
      } else if (
        typeof record.relayServerHost === 'string' &&
        record.relayServerHost.trim().length <= 255
      ) {
        dto.relayServerHost = record.relayServerHost.trim();
      } else {
        throw new BadRequestException(
          'relayServerHost must not exceed 255 characters',
        );
      }
    }

    if (record.publicKey !== undefined) {
      if (record.publicKey === null || record.publicKey === '') {
        dto.publicKey = null;
      } else if (
        typeof record.publicKey === 'string' &&
        record.publicKey.trim().length <= 255
      ) {
        if (record.publicKey.includes('PRIVATE KEY')) {
          throw new BadRequestException(
            'Never store private keys in RustDesk config; only the public key (id_ed25519.pub) is allowed',
          );
        }
        dto.publicKey = record.publicKey.trim();
      } else {
        throw new BadRequestException(
          'publicKey must not exceed 255 characters',
        );
      }
    }

    if (record.clientGuideUrl !== undefined) {
      if (record.clientGuideUrl === null || record.clientGuideUrl === '') {
        dto.clientGuideUrl = null;
      } else if (
        typeof record.clientGuideUrl === 'string' &&
        record.clientGuideUrl.trim().length <= 500
      ) {
        dto.clientGuideUrl = record.clientGuideUrl.trim();
      } else {
        throw new BadRequestException(
          'clientGuideUrl must not exceed 500 characters',
        );
      }
    }

    if (record.reason !== undefined && record.reason !== null) {
      if (
        typeof record.reason !== 'string' ||
        record.reason.trim().length > 500
      ) {
        throw new BadRequestException('reason must not exceed 500 characters');
      }
      const trimmed = record.reason.trim();
      if (trimmed.length > 0) {
        dto.reason = trimmed;
      }
    }

    return dto;
  }
}

export class AdminAuditLogsQueryDto {
  entityType?: string;
  action?: string;
  limit = 50;

  static validate(input: unknown): AdminAuditLogsQueryDto {
    const dto = new AdminAuditLogsQueryDto();
    if (input === undefined || input === null) {
      return dto;
    }

    if (typeof input !== 'object' || Array.isArray(input)) {
      throw new BadRequestException('Invalid audit log query parameters');
    }

    const record = input as Record<string, unknown>;
    if (record.entityType !== undefined && record.entityType !== '') {
      if (typeof record.entityType !== 'string') {
        throw new BadRequestException('entityType must be a string');
      }
      dto.entityType = record.entityType.trim();
    }

    if (record.action !== undefined && record.action !== '') {
      if (typeof record.action !== 'string') {
        throw new BadRequestException('action must be a string');
      }
      dto.action = record.action.trim();
    }

    if (record.limit !== undefined && record.limit !== '') {
      const parsed = Number(record.limit);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 200) {
        throw new BadRequestException('limit must be between 1 and 200');
      }
      dto.limit = parsed;
    }

    return dto;
  }
}
