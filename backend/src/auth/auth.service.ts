import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { promisify } from 'node:util';
import {
  createHmac,
  randomBytes,
  scrypt as callbackScrypt,
  timingSafeEqual,
} from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedUser, RoleCode } from './auth.types.js';
import type { LoginDto, RegisterDto } from './dto/auth.dto.js';

const scrypt = promisify(callbackScrypt);
const SESSION_TTL_SECONDS = 60 * 60 * 8;
const REQUESTER_ROLE = 'REQUESTER' as const;
const DUMMY_PASSWORD_HASH = `scrypt$${Buffer.alloc(16).toString('base64url')}$${Buffer.alloc(64).toString('base64url')}`;

@Injectable()
export class AuthService {
  private readonly sessionSecret: string;

  constructor(private readonly prisma: PrismaService) {
    const secret = process.env.AUTH_SESSION_SECRET;
    if (!secret || Buffer.byteLength(secret) < 32) {
      throw new Error('AUTH_SESSION_SECRET must contain at least 32 bytes');
    }
    this.sessionSecret = secret;
  }

  async register(dto: RegisterDto): Promise<{
    user: AuthenticatedUser;
    token: string;
  }> {
    const passwordHash = await this.hashPassword(dto.password);
    const role = await this.prisma.role.upsert({
      where: { code: REQUESTER_ROLE },
      create: {
        code: REQUESTER_ROLE,
        name: 'Requester',
      },
      update: {},
    });

    try {
      const user = await this.prisma.user.create({
        data: {
          email: dto.email,
          fullName: dto.fullName,
          passwordHash,
          userRoles: {
            create: { roleId: role.id },
          },
        },
        include: { userRoles: { include: { role: true } } },
      });

      const authenticatedUser = this.toAuthenticatedUser(user);
      return {
        user: authenticatedUser,
        token: this.createSessionToken(authenticatedUser.id),
      };
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('An account with this email already exists');
      }
      throw error;
    }
  }

  async login(dto: LoginDto): Promise<{
    user: AuthenticatedUser;
    token: string;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { userRoles: { include: { role: true } } },
    });
    const validPassword = await this.verifyPassword(
      dto.password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );

    if (!user || !user.active || !validPassword) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const authenticatedUser = this.toAuthenticatedUser(user);
    return {
      user: authenticatedUser,
      token: this.createSessionToken(authenticatedUser.id),
    };
  }

  async authenticate(token: string): Promise<AuthenticatedUser> {
    const userId = this.verifySessionToken(token);
    if (!userId) {
      throw new UnauthorizedException('Session is invalid or expired');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { userRoles: { include: { role: true } } },
    });
    if (!user || !user.active) {
      throw new UnauthorizedException('Session is invalid or expired');
    }
    return this.toAuthenticatedUser(user);
  }

  createSessionToken(userId: string): string {
    const payload = Buffer.from(
      JSON.stringify({
        sub: userId,
        exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
      }),
    ).toString('base64url');
    const signature = this.sign(payload);
    return `${payload}.${signature}`;
  }

  private verifySessionToken(token: string): string | null {
    const [payload, signature, extra] = token.split('.');
    if (!payload || !signature || extra !== undefined) {
      return null;
    }

    const expected = Buffer.from(this.sign(payload), 'base64url');
    const actual = Buffer.from(signature, 'base64url');
    if (
      expected.length !== actual.length ||
      !timingSafeEqual(expected, actual)
    ) {
      return null;
    }

    try {
      const value: unknown = JSON.parse(
        Buffer.from(payload, 'base64url').toString('utf8'),
      );
      if (
        !value ||
        typeof value !== 'object' ||
        !('sub' in value) ||
        typeof value.sub !== 'string' ||
        !('exp' in value) ||
        typeof value.exp !== 'number' ||
        value.exp <= Math.floor(Date.now() / 1000)
      ) {
        return null;
      }
      return value.sub;
    } catch {
      return null;
    }
  }

  private sign(payload: string): string {
    return createHmac('sha256', this.sessionSecret)
      .update(payload)
      .digest('base64url');
  }

  private async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16);
    const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
    return `scrypt$${salt.toString('base64url')}$${derivedKey.toString('base64url')}`;
  }

  private async verifyPassword(
    password: string,
    encodedHash: string,
  ): Promise<boolean> {
    const [algorithm, encodedSalt, encodedKey, extra] = encodedHash.split('$');
    if (
      algorithm !== 'scrypt' ||
      !encodedSalt ||
      !encodedKey ||
      extra !== undefined
    ) {
      throw new InternalServerErrorException('Stored password hash is invalid');
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
