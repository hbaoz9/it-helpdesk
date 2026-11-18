import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { AiService } from './ai.service.js';
import { validateAssistInput } from './ai.validation.js';

@UseGuards(AuthGuard, RolesGuard)
@Controller('api/v1/ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Roles('REQUESTER')
  @Post('assist')
  @HttpCode(200)
  assist(@Req() request: AuthenticatedRequest, @Body() input: unknown) {
    return this.aiService.assist(request.user.id, validateAssistInput(input));
  }
}
