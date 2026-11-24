import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import { PrismaClient } from '../dist/generated/prisma/client.js';
import type {
  RoleCode,
  TicketPriority,
} from '../dist/generated/prisma/enums.js';

const SLA_POLICIES_SEED: ReadonlyArray<{
  priority: TicketPriority;
  responseMinutes: number;
  resolutionMinutes: number;
}> = [
  { priority: 'P1', responseMinutes: 15, resolutionMinutes: 240 },
  { priority: 'P2', responseMinutes: 60, resolutionMinutes: 480 },
  { priority: 'P3', responseMinutes: 240, resolutionMinutes: 1440 },
  { priority: 'P4', responseMinutes: 480, resolutionMinutes: 4320 },
];

const ROLES_SEED: ReadonlyArray<{
  code: RoleCode;
  name: string;
  description: string;
}> = [
  {
    code: 'REQUESTER',
    name: 'Requester',
    description: 'Người gửi yêu cầu hỗ trợ CNTT',
  },
  {
    code: 'TECHNICIAN',
    name: 'Technician',
    description: 'Kỹ thuật viên xử lý yêu cầu hỗ trợ CNTT',
  },
  {
    code: 'SUPERVISOR',
    name: 'Supervisor',
    description: 'Quản lý điều phối, phân loại và giám sát SLA',
  },
  {
    code: 'ADMIN',
    name: 'Administrator',
    description: 'Quản trị tài khoản, vai trò, danh mục và cấu hình SLA',
  },
];

const CATEGORIES_SEED: ReadonlyArray<string> = [
  'Mạng & Kết nối (Network / Wi-Fi / VPN)',
  'Thiết bị phần cứng (PC / Laptop / Máy in)',
  'Phần mềm & Ứng dụng nghiệp vụ',
  'Tài khoản & Quyền truy cập (Email / Portal)',
];

const TEST_USERS_SEED: ReadonlyArray<{
  email: string;
  fullName: string;
  roles: RoleCode[];
}> = [
  {
    email: 'requester@helpdesk.local',
    fullName: 'Nhân viên Requester (Local Test)',
    roles: ['REQUESTER'],
  },
  {
    email: 'technician@helpdesk.local',
    fullName: 'Kỹ thuật viên IT (Local Test)',
    roles: ['TECHNICIAN'],
  },
  {
    email: 'supervisor@helpdesk.local',
    fullName: 'Quản lý Supervisor (Local Test)',
    roles: ['SUPERVISOR'],
  },
  {
    email: 'admin@helpdesk.local',
    fullName: 'Quản trị viên Admin (Local Test)',
    roles: ['ADMIN'],
  },
];

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to run database seed');
  }

  const testPassword =
    process.env.SEED_TEST_PASSWORD ?? 'Helpdesk@LocalTest123';
  const passwordHash = await argon2.hash(testPassword, {
    type: argon2.argon2id,
  });

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    const roleMap = new Map<RoleCode, string>();

    for (const roleItem of ROLES_SEED) {
      const role = await prisma.role.upsert({
        where: { code: roleItem.code },
        update: {
          name: roleItem.name,
          description: roleItem.description,
        },
        create: {
          code: roleItem.code,
          name: roleItem.name,
          description: roleItem.description,
        },
      });
      roleMap.set(roleItem.code, role.id);
    }

    for (const categoryName of CATEGORIES_SEED) {
      await prisma.category.upsert({
        where: { name: categoryName },
        update: { active: true },
        create: {
          name: categoryName,
          active: true,
        },
      });
    }

    for (const userItem of TEST_USERS_SEED) {
      const user = await prisma.user.upsert({
        where: { email: userItem.email },
        update: {
          fullName: userItem.fullName,
          passwordHash,
          active: true,
        },
        create: {
          email: userItem.email,
          fullName: userItem.fullName,
          passwordHash,
          active: true,
        },
      });

      for (const roleCode of userItem.roles) {
        const roleId = roleMap.get(roleCode);
        if (!roleId) {
          continue;
        }

        await prisma.userRole.upsert({
          where: {
            userId_roleId: {
              userId: user.id,
              roleId,
            },
          },
          update: {},
          create: {
            userId: user.id,
            roleId,
          },
        });
      }
    }

    for (const slaItem of SLA_POLICIES_SEED) {
      await prisma.slaPolicy.upsert({
        where: { priority: slaItem.priority },
        update: {},
        create: {
          priority: slaItem.priority,
          responseMinutes: slaItem.responseMinutes,
          resolutionMinutes: slaItem.resolutionMinutes,
          revision: 1,
          active: true,
        },
      });
    }

    await prisma.rustdeskServerConfig.upsert({
      where: { singletonKey: 'PRIMARY' },
      update: {},
      create: {
        singletonKey: 'PRIMARY',
        idServerHost: '127.0.0.1:21116',
        relayServerHost: '127.0.0.1:21117',
        publicKey: null,
        approvalTtlMinutes: 15,
        clientGuideUrl: 'https://rustdesk.com/docs/en/client/',
        enabled: true,
      },
    });

    const requesterUser = await prisma.user.findUnique({
      where: { email: 'requester@helpdesk.local' },
    });
    if (requesterUser) {
      await prisma.userDevice.upsert({
        where: { rustdeskId: '102938475' },
        update: {
          ownerId: requesterUser.id,
          label: 'Laptop Requester Demo (Windows 11)',
          osName: 'Windows 11 Pro',
          verificationStatus: 'VERIFIED',
          active: true,
        },
        create: {
          ownerId: requesterUser.id,
          label: 'Laptop Requester Demo (Windows 11)',
          rustdeskId: '102938475',
          osName: 'Windows 11 Pro',
          verificationStatus: 'VERIFIED',
          active: true,
        },
      });
    }

    console.log(
      'Seed completed successfully: 4 roles, 4 categories, 4 SLA policies, RustDesk config, demo device, and 4 local test accounts (Argon2id).',
    );
  } finally {
    await prisma.$disconnect();
  }
}

await main();
