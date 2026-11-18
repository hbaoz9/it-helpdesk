import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AiController } from './ai.controller.js';
import { AiService } from './ai.service.js';
import { AI_PROVIDER } from './ai.types.js';
import { GeminiProvider } from './gemini.provider.js';

@Module({
  imports: [AuthModule],
  controllers: [AiController],
  providers: [AiService, { provide: AI_PROVIDER, useClass: GeminiProvider }],
})
export class AiModule {}
