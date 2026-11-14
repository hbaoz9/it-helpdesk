import { SetMetadata } from '@nestjs/common';
import type { RoleCode } from './auth.types.js';

export const REQUIRED_ROLES = 'requiredRoles';
export const Roles = (...roles: RoleCode[]) =>
  SetMetadata(REQUIRED_ROLES, roles);
