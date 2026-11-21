import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  AuthenticatedSession,
  AuthenticatedUser,
} from './auth.types.js';

export const DEFAULT_SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours
export const REMEMBER_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface CreatedSessionResult {
  sessionId: string;
  rawToken: string;
  expiresAt: Date;
}

export interface ValidatedSessionResult {
  session: AuthenticatedSession;
  user: AuthenticatedUser;
}

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  async createSession(
    userId: string,
    remember = false,
  ): Promise<CreatedSessionResult> {
    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(rawToken);
    const ttlMs = remember ? REMEMBER_SESSION_TTL_MS : DEFAULT_SESSION_TTL_MS;
    const expiresAt = new Date(Date.now() + ttlMs);

    const session = await this.prisma.session.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });

    return {
      sessionId: session.id,
      rawToken,
      expiresAt: session.expiresAt,
    };
  }

  async validateSessionToken(
    rawToken: string,
  ): Promise<ValidatedSessionResult> {
    if (!rawToken || rawToken.trim().length === 0) {
      throw new UnauthorizedException('Authentication session is required');
    }

    const tokenHash = this.hashToken(rawToken);
    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: {
            userRoles: {
              include: {
                role: true,
              },
            },
          },
        },
      },
    });

    if (!session) {
      throw new UnauthorizedException('Session is invalid or expired');
    }

    if (session.revokedAt !== null) {
      throw new UnauthorizedException('Session has been revoked');
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Session has expired');
    }

    if (!session.user.active) {
      throw new UnauthorizedException('User account is inactive');
    }

    const roles = session.user.userRoles.map((ur) => ur.role.code);

    return {
      session: {
        id: session.id,
        expiresAt: session.expiresAt,
      },
      user: {
        id: session.user.id,
        email: session.user.email,
        fullName: session.user.fullName,
        roles,
      },
    };
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: {
        id: sessionId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  async revokeSessionByToken(rawToken: string | undefined): Promise<void> {
    if (!rawToken || rawToken.trim().length === 0) {
      return;
    }

    const tokenHash = this.hashToken(rawToken);
    await this.prisma.session.updateMany({
      where: {
        tokenHash,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  async revokeUserSessions(userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }
}
