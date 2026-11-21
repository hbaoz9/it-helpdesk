import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthGuard } from '../auth/auth.guard.js';
import { AuthService } from '../auth/auth.service.js';
import type { AuthenticatedUser, RoleCode } from '../auth/auth.types.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { SessionService } from '../auth/session.service.js';
import type { TicketPriority } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';
import {
  AdminCategoriesQueryDto,
  AdminUsersQueryDto,
  CreateAdminCategoryDto,
  CreateAdminUserDto,
  UpdateAdminCategoryDto,
  UpdateAdminUserDto,
  UpdateSlaPolicyDto,
} from './dto/admin.dto.js';

describe('AdminModule (Identity, Categories & SLA Policies)', () => {
  let adminController: AdminController;
  let adminService: AdminService;

  const adminActor: AuthenticatedUser = {
    id: 'admin-user-1',
    email: 'admin@helpdesk.local',
    fullName: 'System Administrator',
    roles: ['ADMIN'],
  };

  let usersStore: Map<
    string,
    {
      id: string;
      email: string;
      fullName: string;
      passwordHash: string;
      active: boolean;
      createdAt: Date;
      updatedAt: Date;
      userRoles: { role: { code: RoleCode } }[];
    }
  >;

  let categoriesStore: Map<
    string,
    {
      id: string;
      name: string;
      active: boolean;
      createdAt: Date;
      updatedAt: Date;
      _count: { tickets: number };
    }
  >;

  let slaPoliciesStore: Map<
    string,
    {
      id: string;
      priority: TicketPriority;
      responseMinutes: number;
      resolutionMinutes: number;
      revision: number;
      active: boolean;
      createdAt: Date;
      updatedAt: Date;
    }
  >;

  let auditLogs: Array<{
    actorId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    reason?: string | null;
  }>;

  let revokeUserSessionsSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    usersStore = new Map();
    categoriesStore = new Map();
    slaPoliciesStore = new Map();
    auditLogs = [];
    revokeUserSessionsSpy = vi.fn().mockResolvedValue(undefined);

    usersStore.set(adminActor.id, {
      id: adminActor.id,
      email: adminActor.email,
      fullName: adminActor.fullName,
      passwordHash: '$argon2id$dummy',
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      userRoles: [{ role: { code: 'ADMIN' } }],
    });

    slaPoliciesStore.set('sla-p1', {
      id: 'sla-p1',
      priority: 'P1',
      responseMinutes: 15,
      resolutionMinutes: 240,
      revision: 1,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    slaPoliciesStore.set('sla-p2', {
      id: 'sla-p2',
      priority: 'P2',
      responseMinutes: 60,
      resolutionMinutes: 480,
      revision: 1,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    slaPoliciesStore.set('sla-p3', {
      id: 'sla-p3',
      priority: 'P3',
      responseMinutes: 240,
      resolutionMinutes: 1440,
      revision: 1,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    slaPoliciesStore.set('sla-p4', {
      id: 'sla-p4',
      priority: 'P4',
      responseMinutes: 480,
      resolutionMinutes: 4320,
      revision: 1,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const roleIdToCode = new Map<string, RoleCode>([
      ['role-REQ', 'REQUESTER'],
      ['role-TECH', 'TECHNICIAN'],
      ['role-SUP', 'SUPERVISOR'],
      ['role-ADM', 'ADMIN'],
    ]);
    const roleCodeToId = new Map<RoleCode, string>([
      ['REQUESTER', 'role-REQ'],
      ['TECHNICIAN', 'role-TECH'],
      ['SUPERVISOR', 'role-SUP'],
      ['ADMIN', 'role-ADM'],
    ]);

    let pendingRolesForUser = new Map<string, RoleCode[]>();

    const txMock = {
      role: {
        upsert: vi.fn().mockImplementation(
          ({ where }: { where: { code: RoleCode } }) =>
            Promise.resolve({
              id: roleCodeToId.get(where.code) ?? 'role-REQ',
              code: where.code,
              name: where.code,
            }),
        ),
      },
      user: {
        findMany: vi.fn().mockImplementation(() =>
          Promise.resolve([...usersStore.values()]),
        ),
        findUnique: vi.fn().mockImplementation(
          ({ where }: { where: { id: string } }) =>
            Promise.resolve(usersStore.get(where.id) ?? null),
        ),
        create: vi.fn().mockImplementation(
          ({
            data,
          }: {
            data: {
              email: string;
              fullName: string;
              passwordHash: string;
              active: boolean;
              userRoles: { create: { roleId: string }[] };
            };
          }) => {
            for (const u of usersStore.values()) {
              if (u.email === data.email) {
                const err = new Error('Duplicate email') as Error & {
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
              active: data.active,
              createdAt: new Date(),
              updatedAt: new Date(),
              userRoles: data.userRoles.create.map((r) => ({
                role: { code: roleIdToCode.get(r.roleId) ?? 'REQUESTER' },
              })),
            };
            usersStore.set(created.id, created);
            return Promise.resolve(created);
          },
        ),
        update: vi.fn().mockImplementation(
          ({
            where,
            data,
          }: {
            where: { id: string };
            data: {
              fullName?: string;
              active?: boolean;
              passwordHash?: string;
            };
          }) => {
            const existing = usersStore.get(where.id);
            if (!existing) {
              throw new NotFoundException('User account not found');
            }
            const nextRoles = pendingRolesForUser.get(where.id);
            const updated = {
              ...existing,
              ...(data.fullName !== undefined
                ? { fullName: data.fullName }
                : {}),
              ...(data.active !== undefined ? { active: data.active } : {}),
              ...(data.passwordHash !== undefined
                ? { passwordHash: data.passwordHash }
                : {}),
              ...(nextRoles
                ? {
                    userRoles: nextRoles.map((code) => ({
                      role: { code },
                    })),
                  }
                : {}),
              updatedAt: new Date(),
            };
            pendingRolesForUser.delete(where.id);
            usersStore.set(where.id, updated);
            return Promise.resolve(updated);
          },
        ),
      },
      userRole: {
        deleteMany: vi.fn().mockImplementation(
          ({ where }: { where: { userId: string } }) => {
            pendingRolesForUser.set(where.userId, []);
            return Promise.resolve({ count: 1 });
          },
        ),
        create: vi.fn().mockImplementation(
          ({ data }: { data: { userId: string; roleId: string } }) => {
            const list = pendingRolesForUser.get(data.userId) ?? [];
            const code = roleIdToCode.get(data.roleId) ?? 'REQUESTER';
            list.push(code);
            pendingRolesForUser.set(data.userId, list);
            return Promise.resolve({ id: 'ur-1', ...data });
          },
        ),
      },
      category: {
        findMany: vi.fn().mockImplementation(() =>
          Promise.resolve([...categoriesStore.values()]),
        ),
        findUnique: vi.fn().mockImplementation(
          ({ where }: { where: { id: string } }) =>
            Promise.resolve(categoriesStore.get(where.id) ?? null),
        ),
        create: vi.fn().mockImplementation(
          ({ data }: { data: { name: string; active: boolean } }) => {
            for (const c of categoriesStore.values()) {
              if (c.name.toLowerCase() === data.name.toLowerCase()) {
                const err = new Error('Duplicate category') as Error & {
                  code?: string;
                };
                err.code = 'P2002';
                throw err;
              }
            }
            const created = {
              id: `cat-${categoriesStore.size + 1}`,
              name: data.name,
              active: data.active,
              createdAt: new Date(),
              updatedAt: new Date(),
              _count: { tickets: 0 },
            };
            categoriesStore.set(created.id, created);
            return Promise.resolve(created);
          },
        ),
        update: vi.fn().mockImplementation(
          ({
            where,
            data,
          }: {
            where: { id: string };
            data: { name?: string; active?: boolean };
          }) => {
            const existing = categoriesStore.get(where.id);
            if (!existing) {
              throw new NotFoundException('Category not found');
            }
            const updated = {
              ...existing,
              ...(data.name !== undefined ? { name: data.name } : {}),
              ...(data.active !== undefined ? { active: data.active } : {}),
              updatedAt: new Date(),
            };
            categoriesStore.set(where.id, updated);
            return Promise.resolve(updated);
          },
        ),
      },
      slaPolicy: {
        findMany: vi.fn().mockImplementation(() =>
          Promise.resolve([...slaPoliciesStore.values()]),
        ),
        findUnique: vi.fn().mockImplementation(
          ({ where }: { where: { id: string } }) =>
            Promise.resolve(slaPoliciesStore.get(where.id) ?? null),
        ),
        upsert: vi.fn(),
        update: vi.fn().mockImplementation(
          ({
            where,
            data,
          }: {
            where: { id: string };
            data: { responseMinutes: number; resolutionMinutes: number };
          }) => {
            const existing = slaPoliciesStore.get(where.id);
            if (!existing) {
              throw new NotFoundException('SLA policy not found');
            }
            const updated = {
              ...existing,
              responseMinutes: data.responseMinutes,
              resolutionMinutes: data.resolutionMinutes,
              revision: existing.revision + 1,
              updatedAt: new Date(),
            };
            slaPoliciesStore.set(where.id, updated);
            return Promise.resolve(updated);
          },
        ),
      },
      auditLog: {
        create: vi.fn().mockImplementation(
          ({
            data,
          }: {
            data: {
              actorId?: string | null;
              action: string;
              entityType: string;
              entityId?: string | null;
              reason?: string | null;
            };
          }) => {
            auditLogs.push(data);
            return Promise.resolve({ id: `audit-${auditLogs.length}`, ...data });
          },
        ),
      },
      $transaction: vi.fn(),
    };

    txMock.$transaction.mockImplementation(
      (callback: (tx: typeof txMock) => Promise<unknown>) => callback(txMock),
    );

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        AdminService,
        {
          provide: PrismaService,
          useValue: txMock,
        },
        {
          provide: AuthService,
          useValue: {
            hashPassword: vi
              .fn()
              .mockImplementation((pw: string) =>
                Promise.resolve(`$argon2id$hashed_${pw}`),
              ),
          },
        },
        {
          provide: SessionService,
          useValue: {
            revokeUserSessions: revokeUserSessionsSpy,
          },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    adminController = moduleRef.get<AdminController>(AdminController);
    adminService = moduleRef.get<AdminService>(AdminService);
  });

  describe('DTO Validation', () => {
    it('validates CreateAdminUserDto and UpdateAdminUserDto', () => {
      const createDto = CreateAdminUserDto.validate({
        email: '  NewTech@Helpdesk.local ',
        fullName: '  Tran Van Ky Thuat ',
        password: 'StrongPassword123!',
        roles: ['TECHNICIAN', 'REQUESTER', 'TECHNICIAN'],
      });

      expect(createDto.email).toBe('newtech@helpdesk.local');
      expect(createDto.fullName).toBe('Tran Van Ky Thuat');
      expect(createDto.roles).toEqual(['TECHNICIAN', 'REQUESTER']);
      expect(createDto.active).toBe(true);

      expect(() =>
        CreateAdminUserDto.validate({
          email: 'bad',
          fullName: 'Name',
          password: 'StrongPassword123!',
          roles: ['REQUESTER'],
        }),
      ).toThrow(BadRequestException);

      expect(() => UpdateAdminUserDto.validate({})).toThrow(
        BadRequestException,
      );
    });

    it('validates Category and SLA Policy DTOs', () => {
      const catDto = CreateAdminCategoryDto.validate({
        name: '  Hệ thống ERP ',
      });
      expect(catDto.name).toBe('Hệ thống ERP');
      expect(catDto.active).toBe(true);

      expect(() => UpdateAdminCategoryDto.validate({})).toThrow(
        BadRequestException,
      );
      expect(() =>
        AdminUsersQueryDto.validate({ role: 'INVALID_ROLE' }),
      ).toThrow(BadRequestException);
      expect(() =>
        AdminCategoriesQueryDto.validate({ active: 'invalid' }),
      ).toThrow(BadRequestException);

      const slaDto = UpdateSlaPolicyDto.validate({
        responseMinutes: 30,
        resolutionMinutes: 240,
        reason: ' Điều chỉnh SLA theo quy định mới ',
      });
      expect(slaDto.responseMinutes).toBe(30);
      expect(slaDto.resolutionMinutes).toBe(240);
      expect(slaDto.reason).toBe('Điều chỉnh SLA theo quy định mới');

      expect(() =>
        UpdateSlaPolicyDto.validate({
          responseMinutes: 300,
          resolutionMinutes: 60,
        }),
      ).toThrow(BadRequestException);
    });
  });

  describe('User & Role Management', () => {
    it('creates an internal user account, assigns roles, and writes an audit log', async () => {
      const created = await adminService.createUser(
        adminActor,
        CreateAdminUserDto.validate({
          email: 'staff@helpdesk.local',
          fullName: 'Internal Staff',
          password: 'InitialPassword123!',
          roles: ['REQUESTER', 'TECHNICIAN'],
          active: true,
        }),
      );

      expect(created.email).toBe('staff@helpdesk.local');
      expect(created.roles).toEqual(['REQUESTER', 'TECHNICIAN']);
      expect(created.active).toBe(true);
      expect('passwordHash' in created).toBe(false);
      expect(auditLogs).toContainEqual(
        expect.objectContaining({
          actorId: adminActor.id,
          action: 'USER_CREATED',
          entityType: 'USER',
        }),
      );

      await expect(
        adminService.createUser(
          adminActor,
          CreateAdminUserDto.validate({
            email: 'staff@helpdesk.local',
            fullName: 'Duplicate Staff',
            password: 'InitialPassword123!',
            roles: ['REQUESTER'],
          }),
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('updates user roles, revokes sessions on deactivation, and prevents self-lockout', async () => {
      const created = await adminService.createUser(
        adminActor,
        CreateAdminUserDto.validate({
          email: 'agent@helpdesk.local',
          fullName: 'IT Agent',
          password: 'InitialPassword123!',
          roles: ['TECHNICIAN'],
        }),
      );

      const updated = await adminService.updateUser(
        adminActor,
        created.id,
        UpdateAdminUserDto.validate({
          roles: ['TECHNICIAN', 'SUPERVISOR'],
          active: false,
        }),
      );

      expect(updated.roles).toEqual(['TECHNICIAN', 'SUPERVISOR']);
      expect(updated.active).toBe(false);
      expect(revokeUserSessionsSpy).toHaveBeenCalledWith(created.id);

      // Admin cannot deactivate their own account or remove their own ADMIN role
      await expect(
        adminService.updateUser(
          adminActor,
          adminActor.id,
          UpdateAdminUserDto.validate({ active: false }),
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        adminService.updateUser(
          adminActor,
          adminActor.id,
          UpdateAdminUserDto.validate({ roles: ['REQUESTER'] }),
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Category & SLA Policy Management', () => {
    it('creates, updates, and disables categories while recording audit logs', async () => {
      const { category } = await adminController.createCategory(
        { user: adminActor } as never,
        { name: 'Bảo mật & VPN', active: true },
      );

      expect(category.name).toBe('Bảo mật & VPN');
      expect(category.active).toBe(true);

      const { category: disabled } = await adminController.updateCategory(
        { user: adminActor } as never,
        category.id,
        { active: false },
      );

      expect(disabled.active).toBe(false);
      expect(
        auditLogs.some((log) => log.action === 'CATEGORY_UPDATED'),
      ).toBe(true);
    });

    it('updates SLA policy, increments revision, and writes an audit log', async () => {
      const { slaPolicies } = await adminController.listSlaPolicies();
      expect(slaPolicies).toHaveLength(4);

      const { slaPolicy } = await adminController.updateSlaPolicy(
        { user: adminActor } as never,
        'sla-p1',
        {
          responseMinutes: 10,
          resolutionMinutes: 180,
          reason: 'Tăng cường cam kết P1',
        },
      );

      expect(slaPolicy.responseMinutes).toBe(10);
      expect(slaPolicy.resolutionMinutes).toBe(180);
      expect(slaPolicy.revision).toBe(2);
      expect(
        auditLogs.some(
          (log) =>
            log.action === 'SLA_POLICY_UPDATED' &&
            log.reason === 'Tăng cường cam kết P1',
        ),
      ).toBe(true);
    });
  });
});
