import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { AuthService } from './../src/auth/auth.service.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

describe('AppController & Auth (e2e)', () => {
  let app: INestApplication<App>;
  let prismaService: PrismaService;
  let authService: AuthService;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prismaService = moduleFixture.get<PrismaService>(PrismaService);
    authService = moduleFixture.get<AuthService>(AuthService);
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('/health (GET)', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);

    expect(response.body).toEqual({
      status: 'ok',
      timestamp: expect.any(String),
    });
  });

  it('/health/ready (GET) - healthy database', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health/ready')
      .expect(200);

    expect(response.body).toEqual({
      status: 'ok',
      database: 'up',
      timestamp: expect.any(String),
    });
  });

  it('/health/ready (GET) - unhealthy database returns 503 without sensitive info', async () => {
    vi.spyOn(prismaService, '$queryRaw').mockRejectedValueOnce(
      new Error('postgresql://helpdesk:secret@127.0.0.1:5433/it_helpdesk'),
    );

    const response = await request(app.getHttpServer())
      .get('/api/v1/health/ready')
      .expect(503);

    expect(response.body).toEqual({
      status: 'error',
      database: 'down',
      timestamp: expect.any(String),
    });
    expect(JSON.stringify(response.body)).not.toContain('secret');
    expect(JSON.stringify(response.body)).not.toContain('postgresql://');
  });

  it('/api/v1/auth/login -> /me -> /logout -> /me (HTTP Session & Revocation E2E)', async () => {
    const passwordHash = await authService.hashPassword('E2eTestPassword123!');
    const mockUser = {
      id: '11111111-1111-4111-8111-111111111111',
      email: 'e2e@helpdesk.local',
      fullName: 'E2E User',
      passwordHash,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      userRoles: [{ role: { code: 'REQUESTER' as const } }],
    };

    const sessionsByHash = new Map<
      string,
      {
        id: string;
        userId: string;
        tokenHash: string;
        expiresAt: Date;
        revokedAt: Date | null;
        createdAt: Date;
      }
    >();

    vi.spyOn(prismaService.user, 'findUnique').mockImplementation((args: {
      where?: { email?: string; id?: string };
    }) => {
      if (
        args?.where?.email === mockUser.email ||
        args?.where?.id === mockUser.id
      ) {
        return Promise.resolve(mockUser) as ReturnType<
          typeof prismaService.user.findUnique
        >;
      }
      return Promise.resolve(null) as ReturnType<
        typeof prismaService.user.findUnique
      >;
    });

    vi.spyOn(prismaService.session, 'create').mockImplementation((args: {
      data: { userId: string; tokenHash: string; expiresAt: Date };
    }) => {
      const created = {
        id: '22222222-2222-4222-8222-222222222222',
        userId: args.data.userId,
        tokenHash: args.data.tokenHash,
        expiresAt: args.data.expiresAt,
        revokedAt: null,
        createdAt: new Date(),
      };
      sessionsByHash.set(created.tokenHash, created);
      return Promise.resolve(created) as ReturnType<
        typeof prismaService.session.create
      >;
    });

    vi.spyOn(prismaService.session, 'findUnique').mockImplementation((args: {
      where: { tokenHash?: string };
    }) => {
      const found = args.where.tokenHash
        ? sessionsByHash.get(args.where.tokenHash)
        : undefined;
      if (!found) {
        return Promise.resolve(null) as ReturnType<
          typeof prismaService.session.findUnique
        >;
      }
      return Promise.resolve({
        ...found,
        user: mockUser,
      }) as ReturnType<typeof prismaService.session.findUnique>;
    });

    vi.spyOn(prismaService.session, 'updateMany').mockImplementation((args: {
      where?: { tokenHash?: string };
      data: { revokedAt?: Date | null };
    }) => {
      const hash = args.where?.tokenHash;
      const found = hash ? sessionsByHash.get(hash) : undefined;
      if (found && found.revokedAt === null && args.data.revokedAt) {
        found.revokedAt = args.data.revokedAt;
        return Promise.resolve({ count: 1 }) as ReturnType<
          typeof prismaService.session.updateMany
        >;
      }
      return Promise.resolve({ count: 0 }) as ReturnType<
        typeof prismaService.session.updateMany
      >;
    });

    // 1. Unauthenticated /me returns 401
    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);

    // 2. Login returns 200/201 and sets HttpOnly cookie
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'e2e@helpdesk.local', password: 'E2eTestPassword123!' })
      .expect(201);

    expect(loginRes.body).toEqual({
      user: {
        id: mockUser.id,
        email: mockUser.email,
        fullName: mockUser.fullName,
        roles: ['REQUESTER'],
      },
    });

    const setCookieHeader = loginRes.headers['set-cookie'];
    expect(setCookieHeader).toBeDefined();
    const cookieLine = Array.isArray(setCookieHeader)
      ? setCookieHeader[0]
      : setCookieHeader;
    expect(cookieLine).toContain('it_helpdesk_session=');
    expect(cookieLine).toContain('HttpOnly');

    // 3. Authenticated /me succeeds with the session cookie
    const meRes = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', cookieLine)
      .expect(200);

    expect(meRes.body).toEqual({
      user: {
        id: mockUser.id,
        email: mockUser.email,
        fullName: mockUser.fullName,
        roles: ['REQUESTER'],
      },
    });

    // 4. Logout revokes session on server and clears cookie
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', cookieLine)
      .expect(201);

    // 5. Reusing old cookie after logout is rejected with 401
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', cookieLine)
      .expect(401);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await app.close();
  });
});
