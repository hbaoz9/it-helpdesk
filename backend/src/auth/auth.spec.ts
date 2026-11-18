import {
  BadRequestException,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import type { Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard, SESSION_COOKIE } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import type { AuthenticatedRequest, RoleCode } from './auth.types.js';
import { LoginDto } from './dto/auth.dto.js';
import { RolesGuard } from './roles.guard.js';
import { SessionService } from './session.service.js';

interface StoredSession {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

describe('AuthModule (Session, Argon2id & RBAC)', () => {
  let authController: AuthController;
  let authService: AuthService;
  let sessionService: SessionService;
  let authGuard: AuthGuard;
  let rolesGuard: RolesGuard;
  let reflector: Reflector;

  let sessionsStore: Map<string, StoredSession>;
  let usersStore: Map<
    string,
    {
      id: string;
      email: string;
      fullName: string;
      passwordHash: string;
      active: boolean;
      userRoles: { role: { code: RoleCode } }[];
    }
  >;

  let prismaMock: {
    role: { upsert: ReturnType<typeof vi.fn> };
    user: {
      create: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
    };
    session: {
      create: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    sessionsStore = new Map();
    usersStore = new Map();

    prismaMock = {
      role: {
        upsert: vi.fn().mockResolvedValue({
          id: 'role-requester-id',
          code: 'REQUESTER',
          name: 'Requester',
        }),
      },
      user: {
        create: vi.fn().mockImplementation(
          ({
            data,
          }: {
            data: {
              email: string;
              fullName: string;
              passwordHash: string;
            };
          }) => {
            for (const existing of usersStore.values()) {
              if (existing.email === data.email) {
                const err = new Error('Unique constraint') as Error & {
                  code?: string;
                };
                err.code = 'P2002';
                throw err;
              }
            }
            const created = {
              id: `user-${usersStore.size + 1}`,
              email: data.email,
              fullName: data.fullName,
              passwordHash: data.passwordHash,
              active: true,
              userRoles: [{ role: { code: 'REQUESTER' as RoleCode } }],
            };
            usersStore.set(created.id, created);
            return Promise.resolve(created);
          },
        ),
        findUnique: vi.fn().mockImplementation(
          ({ where }: { where: { email?: string; id?: string } }) => {
            if (where.email) {
              for (const u of usersStore.values()) {
                if (u.email === where.email) {
                  return Promise.resolve(u);
                }
              }
              return Promise.resolve(null);
            }
            if (where.id) {
              return Promise.resolve(usersStore.get(where.id) ?? null);
            }
            return Promise.resolve(null);
          },
        ),
      },
      session: {
        create: vi.fn().mockImplementation(
          ({
            data,
          }: {
            data: { userId: string; tokenHash: string; expiresAt: Date };
          }) => {
            const session: StoredSession = {
              id: `sess-${sessionsStore.size + 1}`,
              userId: data.userId,
              tokenHash: data.tokenHash,
              expiresAt: data.expiresAt,
              revokedAt: null,
              createdAt: new Date(),
            };
            sessionsStore.set(session.tokenHash, session);
            return Promise.resolve(session);
          },
        ),
        findUnique: vi.fn().mockImplementation(
          ({ where }: { where: { tokenHash: string } }) => {
            const sess = sessionsStore.get(where.tokenHash);
            if (!sess) {
              return Promise.resolve(null);
            }
            const user = usersStore.get(sess.userId);
            if (!user) {
              return Promise.resolve(null);
            }
            return Promise.resolve({
              ...sess,
              user,
            });
          },
        ),
        updateMany: vi.fn().mockImplementation(
          ({
            where,
            data,
          }: {
            where: { id?: string; tokenHash?: string; revokedAt: null };
            data: { revokedAt: Date };
          }) => {
            let count = 0;
            for (const sess of sessionsStore.values()) {
              const matchId = where.id ? sess.id === where.id : true;
              const matchHash = where.tokenHash
                ? sess.tokenHash === where.tokenHash
                : true;
              if (matchId && matchHash && sess.revokedAt === null) {
                sess.revokedAt = data.revokedAt;
                count += 1;
              }
            }
            return Promise.resolve({ count });
          },
        ),
      },
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        SessionService,
        AuthService,
        AuthGuard,
        RolesGuard,
        Reflector,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    authController = moduleRef.get<AuthController>(AuthController);
    authService = moduleRef.get<AuthService>(AuthService);
    sessionService = moduleRef.get<SessionService>(SessionService);
    authGuard = moduleRef.get<AuthGuard>(AuthGuard);
    rolesGuard = moduleRef.get<RolesGuard>(RolesGuard);
    reflector = moduleRef.get<Reflector>(Reflector);
  });

  describe('DTO Validation', () => {
    it('validates LoginDto and normalizes email', () => {
      const dto = LoginDto.validate({
        email: '  Requester@UTH.edu.vn ',
        password: 'ValidPassword123!',
        remember: true,
      });

      expect(dto.email).toBe('requester@uth.edu.vn');
      expect(dto.password).toBe('ValidPassword123!');
      expect(dto.remember).toBe(true);
    });

    it('rejects invalid LoginDto payloads', () => {
      expect(() => LoginDto.validate(null)).toThrow(BadRequestException);
      expect(() =>
        LoginDto.validate({ email: 'not-an-email', password: '123' }),
      ).toThrow(BadRequestException);
    });
  });

  describe('Argon2id Password Hashing & Login Flow', () => {
    it('hashes passwords with Argon2id and creates a server-side session on login', async () => {
      const passwordHash = await authService.hashPassword(
        'StrongPassword123!',
      );
      expect(passwordHash.startsWith('$argon2id$')).toBe(true);

      usersStore.set('user-1', {
        id: 'user-1',
        email: 'hien@uth.edu.vn',
        fullName: 'Nguyen Manh Hien',
        passwordHash,
        active: true,
        userRoles: [
          { role: { code: 'REQUESTER' } },
          { role: { code: 'ADMIN' } },
        ],
      });

      const loginResult = await authService.login(
        LoginDto.validate({
          email: 'HIEN@uth.edu.vn',
          password: 'StrongPassword123!',
        }),
      );

      expect(loginResult.user).toEqual({
        id: 'user-1',
        email: 'hien@uth.edu.vn',
        fullName: 'Nguyen Manh Hien',
        roles: ['REQUESTER', 'ADMIN'],
      });
      expect(loginResult.token).toBeTruthy();

      // Raw token must never be stored directly in DB; only its SHA-256 hash is stored
      expect(sessionsStore.has(loginResult.token)).toBe(false);
      const expectedHash = sessionService.hashToken(loginResult.token);
      expect(sessionsStore.has(expectedHash)).toBe(true);
    });

    it('rejects non-existent email, wrong password, and inactive user', async () => {
      const passwordHash = await authService.hashPassword(
        'CorrectPassword123!',
      );
      usersStore.set('user-2', {
        id: 'user-2',
        email: 'active@uth.edu.vn',
        fullName: 'Active User',
        passwordHash,
        active: true,
        userRoles: [{ role: { code: 'REQUESTER' } }],
      });
      usersStore.set('user-3', {
        id: 'user-3',
        email: 'locked@uth.edu.vn',
        fullName: 'Locked User',
        passwordHash,
        active: false,
        userRoles: [{ role: { code: 'REQUESTER' } }],
      });

      await expect(
        authService.login(
          LoginDto.validate({
            email: 'unknown@uth.edu.vn',
            password: 'CorrectPassword123!',
          }),
        ),
      ).rejects.toThrow(UnauthorizedException);

      await expect(
        authService.login(
          LoginDto.validate({
            email: 'active@uth.edu.vn',
            password: 'WrongPassword123!',
          }),
        ),
      ).rejects.toThrow(UnauthorizedException);

      await expect(
        authService.login(
          LoginDto.validate({
            email: 'locked@uth.edu.vn',
            password: 'CorrectPassword123!',
          }),
        ),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('Server-side Session Lifecycle (Expiration, Revocation & Cookie)', () => {
    it('sets HttpOnly cookie on login and revokes session in DB on logout', async () => {
      const passwordHash = await authService.hashPassword(
        'SessionPassword123!',
      );
      usersStore.set('user-10', {
        id: 'user-10',
        email: 'tech@uth.edu.vn',
        fullName: 'IT Technician',
        passwordHash,
        active: true,
        userRoles: [{ role: { code: 'TECHNICIAN' } }],
      });

      const cookieSpy = vi.fn();
      const clearCookieSpy = vi.fn();
      const mockResponse = {
        cookie: cookieSpy,
        clearCookie: clearCookieSpy,
      } as unknown as Response;

      const responseBody = await authController.login(
        { email: 'tech@uth.edu.vn', password: 'SessionPassword123!' },
        mockResponse,
      );

      expect(responseBody.user.roles).toEqual(['TECHNICIAN']);
      expect(cookieSpy).toHaveBeenCalledTimes(1);
      const [cookieName, rawToken, cookieOpts] = cookieSpy.mock.calls[0] as [
        string,
        string,
        Record<string, unknown>,
      ];
      expect(cookieName).toBe(SESSION_COOKIE);
      expect(cookieOpts.httpOnly).toBe(true);
      expect(cookieOpts.sameSite).toBe('lax');

      // Session is valid before logout
      const authenticated = await authService.authenticate(rawToken);
      expect(authenticated.id).toBe('user-10');

      // Logout revokes the session in PostgreSQL and clears cookie
      const mockLogoutReq = {
        headers: {
          cookie: `${SESSION_COOKIE}=${rawToken}`,
        },
      } as unknown as Request;

      const logoutResult = await authController.logout(
        mockLogoutReq,
        mockResponse,
      );
      expect(logoutResult).toEqual({ success: true });
      expect(clearCookieSpy).toHaveBeenCalledTimes(1);

      // Reusing the revoked session token must fail with 401 Unauthorized
      await expect(authService.authenticate(rawToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects expired sessions', async () => {
      usersStore.set('user-exp', {
        id: 'user-exp',
        email: 'exp@uth.edu.vn',
        fullName: 'Expired User',
        passwordHash: 'unused',
        active: true,
        userRoles: [{ role: { code: 'REQUESTER' } }],
      });

      const created = await sessionService.createSession('user-exp');
      const stored = sessionsStore.get(
        sessionService.hashToken(created.rawToken),
      );
      if (stored) {
        stored.expiresAt = new Date(Date.now() - 1000);
      }

      await expect(
        authService.authenticate(created.rawToken),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('AuthGuard & RolesGuard (RBAC)', () => {
    it('populates request.user from DB session in AuthGuard and enforces RolesGuard', async () => {
      usersStore.set('user-sup', {
        id: 'user-sup',
        email: 'sup@uth.edu.vn',
        fullName: 'Supervisor User',
        passwordHash: 'unused',
        active: true,
        userRoles: [{ role: { code: 'SUPERVISOR' } }],
      });

      const created = await sessionService.createSession('user-sup');
      const mockReq = {
        headers: {
          cookie: `${SESSION_COOKIE}=${created.rawToken}`,
        },
      } as unknown as AuthenticatedRequest;

      const context = {
        switchToHttp: () => ({
          getRequest: () => mockReq,
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;

      const canActivateAuth = await authGuard.canActivate(context);
      expect(canActivateAuth).toBe(true);
      expect(mockReq.user.roles).toEqual(['SUPERVISOR']);

      // Allowed when route requires SUPERVISOR
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce([
        'SUPERVISOR',
      ]);
      expect(rolesGuard.canActivate(context)).toBe(true);

      // Forbidden when route requires ADMIN
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(['ADMIN']);
      expect(() => rolesGuard.canActivate(context)).toThrow(
        ForbiddenException,
      );
    });
  });
});
