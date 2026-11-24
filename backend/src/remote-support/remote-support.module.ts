import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { RemoteSupportController } from './remote-support.controller.js';
import { RemoteSupportService } from './remote-support.service.js';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [RemoteSupportController],
  providers: [RemoteSupportService],
  exports: [RemoteSupportService],
})
export class RemoteSupportModule {}
