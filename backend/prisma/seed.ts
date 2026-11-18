import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import { PrismaClient } from '../dist/generated/prisma/client.js';
import type { RoleCode } from '../dist/generated/prisma/enums.js';

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

    console.log(
      'Seed completed successfully: 4 roles, 4 categories, and 4 local test accounts (Argon2id).',
    );
  } finally {
    await prisma.$disconnect();
  }
}

await main();
