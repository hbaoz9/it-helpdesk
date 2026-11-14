import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest, RoleCode } from './auth.types.js';
import { REQUIRED_ROLES } from './roles.decorator.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<RoleCode[]>(
      REQUIRED_ROLES,
      [context.getHandler(), context.getClass()],
    );
    if (!roles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user.roles.some((role) => roles.includes(role))) {
      throw new ForbiddenException('You do not have permission for this action');
    }
    return true;
  }
}
