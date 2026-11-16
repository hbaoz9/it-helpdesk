import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  getPrismaClient(): PrismaService {
    return this.prisma;
  }

  findActive() {
    return this.prisma.category.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, active: true },
    });
  }
}
