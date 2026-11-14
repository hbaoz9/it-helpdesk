import { Module } from '@nestjs/common';
import { CategoriesModule } from '../categories/categories.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { TicketsController } from './tickets.controller.js';
import { TicketsService } from './tickets.service.js';

@Module({
  imports: [PrismaModule, CategoriesModule],
  controllers: [TicketsController],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}
