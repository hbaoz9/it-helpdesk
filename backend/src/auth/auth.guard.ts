import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthenticatedRequest } from './auth.types.js';
import { AuthService } from './auth.service.js';

const SESSION_COOKIE = 'it_helpdesk_session';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const cookieHeader = request.headers.cookie;
    const match = cookieHeader?.match(
      /(?:^|;\s*)it_helpdesk_session=([^;]+)/,
    );
    if (!match?.[1]) {
      throw new UnauthorizedException('Authentication is required');
    }

    request.user = await this.authService.authenticate(match[1]);
    return true;
  }
}

export { SESSION_COOKIE };
