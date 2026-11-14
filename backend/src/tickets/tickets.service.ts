import { Injectable } from '@nestjs/common';
import { CategoriesService } from '../categories/categories.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categoriesService: CategoriesService,
  ) {}

  getPrismaClient(): PrismaService {
    return this.prisma;
  }

  getCategoriesService(): CategoriesService {
    return this.categoriesService;
  }
}
