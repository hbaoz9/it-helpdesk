import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { scrypt as callbackScrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedUser, RoleCode } from './auth.types.js';
import type { LoginDto } from './dto/auth.dto.js';
import { SessionService } from './session.service.js';

const scrypt = promisify(callbackScrypt);

// Precomputed Argon2id hash to mitigate user-enumeration timing attacks
const DUMMY_ARGON2ID_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHR2YWx1ZQ$RdescudvJCsgt3ub+b+dWRWJTmaaJObG';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionService: SessionService,
  ) {}

  async login(dto: LoginDto): Promise<{
    user: AuthenticatedUser;
    token: string;
    expiresAt: Date;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { userRoles: { include: { role: true } } },
    });

    const validPassword = await this.verifyPassword(
      dto.password,
      user?.passwordHash ?? DUMMY_ARGON2ID_HASH,
    );

    if (!user || !user.active || !validPassword) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const authenticatedUser = this.toAuthenticatedUser(user);
    const session = await this.sessionService.createSession(
      authenticatedUser.id,
      Boolean(dto.remember),
    );

    return {
      user: authenticatedUser,
      token: session.rawToken,
      expiresAt: session.expiresAt,
    };
  }

  async authenticate(token: string): Promise<AuthenticatedUser> {
    const result = await this.sessionService.validateSessionToken(token);
    return result.user;
  }

  async logout(token?: string): Promise<void> {
    await this.sessionService.revokeSessionByToken(token);
  }

  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
    });
  }

  async verifyPassword(
    password: string,
    encodedHash: string,
  ): Promise<boolean> {
    if (encodedHash.startsWith('$argon2')) {
      try {
        return await argon2.verify(encodedHash, password);
      } catch {
        return false;
      }
    }

    if (encodedHash.startsWith('scrypt$')) {
      const [, encodedSalt, encodedKey, extra] = encodedHash.split('$');
      if (!encodedSalt || !encodedKey || extra !== undefined) {
        return false;
      }

      const salt = Buffer.from(encodedSalt, 'base64url');
      const expected = Buffer.from(encodedKey, 'base64url');
      const actual = (await scrypt(password, salt, expected.length)) as Buffer;
      return (
        expected.length > 0 &&
        expected.length === actual.length &&
        timingSafeEqual(expected, actual)
      );
    }

    return false;
  }

  private toAuthenticatedUser(user: {
    id: string;
    email: string;
    fullName: string;
    userRoles: { role: { code: RoleCode } }[];
  }): AuthenticatedUser {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      roles: user.userRoles.map(({ role }) => role.code),
    };
  }
}
