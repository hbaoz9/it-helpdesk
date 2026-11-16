import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service.js';
import type { AuthenticatedRequest } from './auth.types.js';

export const SESSION_COOKIE = 'it_helpdesk_session';

export function extractSessionToken(request: Request): string | undefined {
  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) {
    return undefined;
  }

  const match = cookieHeader.match(/(?:^|;\s*)it_helpdesk_session=([^;]+)/);
  if (!match?.[1]) {
    return undefined;
  }

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractSessionToken(request);

    if (!token) {
      throw new UnauthorizedException('Authentication is required');
    }

    request.user = await this.authService.authenticate(token);
    request.sessionToken = token;
    return true;
  }
}
