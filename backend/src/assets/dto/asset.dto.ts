import { BadRequestException } from '@nestjs/common';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function recordOf(input: unknown, label: string): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new BadRequestException(`Invalid ${label} payload`);
  }
  return input as Record<string, unknown>;
}

function readString(
  record: Record<string, unknown>,
  key: string,
  required: true,
  maxLength?: number,
  allowNull?: false,
): string;
function readString(
  record: Record<string, unknown>,
  key: string,
  required?: false,
  maxLength?: number,
  allowNull?: false,
): string | undefined;
function readString(
  record: Record<string, unknown>,
  key: string,
  required: boolean,
  maxLength: number,
  allowNull: true,
): string | null | undefined;
function readString(
  record: Record<string, unknown>,
  key: string,
  required?: boolean,
  maxLength?: number,
  allowNull?: false,
): string | undefined;
function readString(
  record: Record<string, unknown>,
  key: string,
  required: boolean,
  maxLength: number,
  allowNull: true,
): string | null | undefined;
function readString(
  record: Record<string, unknown>,
  key: string,
  required = false,
  maxLength = 500,
  allowNull = false,
): string | null | undefined {
  const value = record[key];
  if (value === null && allowNull) return null;
  if (value === undefined || value === null) {
    if (required) throw new BadRequestException(`${key} is required`);
    return undefined;
  }
  if (typeof value !== 'string' || value.trim().length > maxLength) {
    throw new BadRequestException(
      `${key} must be a string of at most ${maxLength} characters`,
    );
  }
  const normalized = value.trim();
  if (required && !normalized)
    throw new BadRequestException(`${key} is required`);
  return normalized;
}

function readDate(
  record: Record<string, unknown>,
  key: string,
): Date | null | undefined {
  const value = record[key];
  if (value === null) return null;
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw new BadRequestException(`${key} must be a valid date`);
  }
  return new Date(value);
}

function readMoney(
  record: Record<string, unknown>,
  key: string,
): number | null | undefined {
  const value = record[key];
  if (value === null) return null;
  if (value === undefined || value === '') return undefined;
  const amount = typeof value === 'number' ? value : Number(value);
  const decimalValue =
    typeof value === 'number'
      ? value.toString()
      : typeof value === 'string'
        ? value
        : '';
  if (
    !Number.isFinite(amount) ||
    amount < 0 ||
    !/^\d+(\.\d{1,2})?$/.test(decimalValue)
  ) {
    throw new BadRequestException(
      `${key} must be a non-negative amount with up to 2 decimal places`,
    );
  }
  return amount;
}

function readUuid(
  record: Record<string, unknown>,
  key: string,
  required = false,
) {
  const value = readString(record, key, required, 36);
  if (typeof value === 'string' && !UUID_PATTERN.test(value)) {
    throw new BadRequestException(`${key} must be a UUID`);
  }
  return value;
}

const ASSET_STATUSES = [
  'AVAILABLE',
  'ASSIGNED',
  'UNDER_MAINTENANCE',
  'RETIRED',
  'DISPOSED',
  'LOST',
] as const;
const ASSET_CONDITIONS = ['NEW', 'GOOD', 'FAIR', 'POOR', 'DAMAGED'] as const;
const MAINTENANCE_TYPES = [
  'REPAIR',
  'MAINTENANCE',
  'UPGRADE',
  'INSPECTION',
] as const;
const MAINTENANCE_STATUSES = [
  'SCHEDULED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
] as const;
const ASSET_HISTORY_ACTIONS = [
  'CREATED',
  'UPDATED',
  'STATUS_CHANGED',
  'ASSIGNED',
  'RETURNED',
  'MAINTENANCE_CREATED',
  'MAINTENANCE_UPDATED',
  'DELETED',
] as const;

export class AssetQueryDto {
  page = 1;
  limit = 50;
  search?: string;
  categoryId?: string;
  status?: (typeof ASSET_STATUSES)[number];

  static validate(input: unknown): AssetQueryDto {
    const record = recordOf(input ?? {}, 'asset query');
    const dto = new AssetQueryDto();
    const page = record.page === undefined ? 1 : Number(record.page);
    const limit = record.limit === undefined ? 50 : Number(record.limit);
    if (!Number.isInteger(page) || page < 1)
      throw new BadRequestException('page must be a positive integer');
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new BadRequestException('limit must be between 1 and 100');
    }
    dto.page = page;
    dto.limit = limit;
    dto.search = readString(record, 'search', false, 100);
    dto.categoryId = readUuid(record, 'categoryId');
    if (record.status !== undefined) {
      if (
        !ASSET_STATUSES.includes(
          record.status as (typeof ASSET_STATUSES)[number],
        )
      ) {
        throw new BadRequestException('status is invalid');
      }
      dto.status = record.status as (typeof ASSET_STATUSES)[number];
    }
    return dto;
  }
}

export class AssetRecordsQueryDto {
  page = 1;
  limit = 50;
  search?: string;
  assetId?: string;
  status?: (typeof MAINTENANCE_STATUSES)[number] | 'ACTIVE' | 'RETURNED';
  type?: (typeof ASSET_HISTORY_ACTIONS)[number];
  dateFrom?: Date;
  dateTo?: Date;

  static validate(input: unknown): AssetRecordsQueryDto {
    const record = recordOf(input ?? {}, 'asset records query');
    const dto = new AssetRecordsQueryDto();
    const page = record.page === undefined ? 1 : Number(record.page);
    const limit = record.limit === undefined ? 50 : Number(record.limit);
    if (!Number.isInteger(page) || page < 1) {
      throw new BadRequestException('page must be a positive integer');
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new BadRequestException('limit must be between 1 and 100');
    }
    dto.page = page;
    dto.limit = limit;
    dto.search = readString(record, 'search', false, 100);
    dto.assetId = readUuid(record, 'assetId');
    if (record.status !== undefined) {
      const statuses = [...MAINTENANCE_STATUSES, 'ACTIVE', 'RETURNED'] as const;
      if (!statuses.includes(record.status as (typeof statuses)[number])) {
        throw new BadRequestException('status is invalid');
      }
      dto.status = record.status as (typeof statuses)[number];
    }
    if (record.type !== undefined) {
      if (
        !ASSET_HISTORY_ACTIONS.includes(
          record.type as (typeof ASSET_HISTORY_ACTIONS)[number],
        )
      ) {
        throw new BadRequestException('type is invalid');
      }
      dto.type = record.type as (typeof ASSET_HISTORY_ACTIONS)[number];
    }
    dto.dateFrom = readDate(record, 'dateFrom') ?? undefined;
    dto.dateTo = readDate(record, 'dateTo') ?? undefined;
    if (dto.dateFrom && dto.dateTo && dto.dateFrom > dto.dateTo) {
      throw new BadRequestException(
        'dateFrom must be before or equal to dateTo',
      );
    }
    return dto;
  }
}

export class CreateAssetDto {
  assetTag?: string;
  name!: string;
  categoryId!: string;
  manufacturer?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  condition?: (typeof ASSET_CONDITIONS)[number];
  purchaseDate?: Date | null;
  purchaseCost?: number | null;
  warrantyExpires?: Date | null;
  location?: string | null;
  notes?: string | null;

  static validate(input: unknown): CreateAssetDto {
    const record = recordOf(input, 'asset');
    const dto = new CreateAssetDto();
    dto.assetTag = readString(record, 'assetTag', false, 80);
    dto.name = readString(record, 'name', true, 150)!;
    dto.categoryId = readUuid(record, 'categoryId', true)!;
    dto.manufacturer = readString(record, 'manufacturer', false, 100, true);
    dto.model = readString(record, 'model', false, 100, true);
    dto.serialNumber = readString(record, 'serialNumber', false, 120, true);
    dto.condition = readEnum(record, 'condition', ASSET_CONDITIONS);
    dto.purchaseDate = readDate(record, 'purchaseDate');
    dto.purchaseCost = readMoney(record, 'purchaseCost');
    dto.warrantyExpires = readDate(record, 'warrantyExpires');
    dto.location = readString(record, 'location', false, 150, true);
    dto.notes = readString(record, 'notes', false, 4000, true);
    return dto;
  }
}

export class UpdateAssetDto {
  assetTag?: string;
  name?: string;
  categoryId?: string;
  manufacturer?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  condition?: (typeof ASSET_CONDITIONS)[number];
  purchaseDate?: Date | null;
  purchaseCost?: number | null;
  warrantyExpires?: Date | null;
  location?: string | null;
  notes?: string | null;

  static validate(input: unknown): UpdateAssetDto {
    const record = recordOf(input, 'asset');
    const dto = new UpdateAssetDto();
    dto.assetTag = readString(record, 'assetTag', false, 80);
    dto.name = readString(record, 'name', false, 150);
    if (dto.assetTag !== undefined && !dto.assetTag) {
      throw new BadRequestException('assetTag must not be empty');
    }
    if (dto.name !== undefined && !dto.name) {
      throw new BadRequestException('name must not be empty');
    }
    dto.categoryId = readUuid(record, 'categoryId');
    dto.manufacturer = readString(record, 'manufacturer', false, 100, true);
    dto.model = readString(record, 'model', false, 100, true);
    dto.serialNumber = readString(record, 'serialNumber', false, 120, true);
    dto.condition = readEnum(record, 'condition', ASSET_CONDITIONS);
    dto.purchaseDate = readDate(record, 'purchaseDate');
    dto.purchaseCost = readMoney(record, 'purchaseCost');
    dto.warrantyExpires = readDate(record, 'warrantyExpires');
    dto.location = readString(record, 'location', false, 150, true);
    dto.notes = readString(record, 'notes', false, 4000, true);
    if (!Object.values(dto).some((value) => value !== undefined)) {
      throw new BadRequestException(
        'At least one asset field must be provided',
      );
    }
    return dto;
  }
}

export class AssetStatusDto {
  status!: (typeof ASSET_STATUSES)[number];

  static validate(input: unknown): AssetStatusDto {
    const record = recordOf(input, 'asset status');
    const status = record.status;
    if (!ASSET_STATUSES.includes(status as (typeof ASSET_STATUSES)[number])) {
      throw new BadRequestException('status is invalid');
    }
    const dto = new AssetStatusDto();
    dto.status = status as (typeof ASSET_STATUSES)[number];
    return dto;
  }
}

export class AssignAssetDto {
  userId!: string;
  notes?: string;
  conditionAtAssignment?: (typeof ASSET_CONDITIONS)[number];

  static validate(input: unknown): AssignAssetDto {
    const record = recordOf(input, 'asset assignment');
    const dto = new AssignAssetDto();
    dto.userId = readUuid(record, 'userId', true)!;
    dto.notes = readString(record, 'notes', false, 1000);
    dto.conditionAtAssignment = readEnum(
      record,
      'conditionAtAssignment',
      ASSET_CONDITIONS,
    );
    return dto;
  }
}

export class ReturnAssetDto {
  notes?: string;
  conditionAtReturn?: (typeof ASSET_CONDITIONS)[number];

  static validate(input: unknown): ReturnAssetDto {
    const record = recordOf(input ?? {}, 'asset return');
    const dto = new ReturnAssetDto();
    dto.notes = readString(record, 'notes', false, 1000);
    dto.conditionAtReturn = readEnum(
      record,
      'conditionAtReturn',
      ASSET_CONDITIONS,
    );
    return dto;
  }
}

export class CreateMaintenanceDto {
  title!: string;
  type!: (typeof MAINTENANCE_TYPES)[number];
  description?: string | null;
  diagnosis?: string | null;
  resolution?: string | null;
  notes?: string | null;
  provider?: string | null;
  cost?: number | null;
  scheduledAt?: Date | null;

  static validate(input: unknown): CreateMaintenanceDto {
    const record = recordOf(input, 'maintenance');
    const dto = new CreateMaintenanceDto();
    dto.title = readString(record, 'title', true, 150)!;
    dto.type = readEnum(record, 'type', MAINTENANCE_TYPES) ?? 'MAINTENANCE';
    dto.description = readString(record, 'description', false, 4000, true);
    dto.diagnosis = readString(record, 'diagnosis', false, 4000, true);
    dto.resolution = readString(record, 'resolution', false, 4000, true);
    dto.notes = readString(record, 'notes', false, 4000, true);
    dto.provider = readString(record, 'provider', false, 150, true);
    dto.cost = readMoney(record, 'cost');
    dto.scheduledAt = readDate(record, 'scheduledAt');
    return dto;
  }
}

export class UpdateMaintenanceDto {
  status!: (typeof MAINTENANCE_STATUSES)[number];
  description?: string | null;
  diagnosis?: string | null;
  resolution?: string | null;
  notes?: string | null;
  provider?: string | null;
  cost?: number | null;
  scheduledAt?: Date | null;

  static validate(input: unknown): UpdateMaintenanceDto {
    const record = recordOf(input, 'maintenance');
    const dto = new UpdateMaintenanceDto();
    dto.status = readEnum(record, 'status', MAINTENANCE_STATUSES, true)!;
    dto.description = readString(record, 'description', false, 4000, true);
    dto.diagnosis = readString(record, 'diagnosis', false, 4000, true);
    dto.resolution = readString(record, 'resolution', false, 4000, true);
    dto.notes = readString(record, 'notes', false, 4000, true);
    dto.provider = readString(record, 'provider', false, 150, true);
    dto.cost = readMoney(record, 'cost');
    dto.scheduledAt = readDate(record, 'scheduledAt');
    return dto;
  }
}

export class AssetCategoryDto {
  name!: string;
  description?: string | null;
  active?: boolean;

  static validate(input: unknown): AssetCategoryDto {
    const record = recordOf(input, 'asset category');
    const dto = new AssetCategoryDto();
    dto.name = readString(record, 'name', true, 100)!;
    dto.description = readString(record, 'description', false, 1000, true);
    if (record.active !== undefined) {
      if (typeof record.active !== 'boolean') {
        throw new BadRequestException('active must be a boolean');
      }
      dto.active = record.active;
    }
    return dto;
  }
}

export class UpdateAssetCategoryDto {
  name?: string;
  description?: string | null;
  active?: boolean;

  static validate(input: unknown): UpdateAssetCategoryDto {
    const record = recordOf(input, 'asset category');
    const dto = new UpdateAssetCategoryDto();
    dto.name = readString(record, 'name', false, 100);
    if (dto.name !== undefined && !dto.name) {
      throw new BadRequestException('name must not be empty');
    }
    dto.description = readString(record, 'description', false, 1000, true);
    if (record.active !== undefined) {
      if (typeof record.active !== 'boolean') {
        throw new BadRequestException('active must be a boolean');
      }
      dto.active = record.active;
    }
    if (!Object.values(dto).some((value) => value !== undefined)) {
      throw new BadRequestException(
        'At least one asset category field must be provided',
      );
    }
    return dto;
  }
}

function readEnum<const T extends readonly string[]>(
  record: Record<string, unknown>,
  key: string,
  options: T,
  required = false,
): T[number] | undefined {
  const value = record[key];
  if (value === undefined) {
    if (required) throw new BadRequestException(`${key} is required`);
    return undefined;
  }
  if (!options.includes(value as T[number])) {
    throw new BadRequestException(`${key} is invalid`);
  }
  return value as T[number];
}
