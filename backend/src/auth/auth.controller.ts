import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service.js';
import { AuthGuard, SESSION_COOKIE } from './auth.guard.js';
import type { AuthenticatedRequest } from './auth.types.js';
import { LoginDto, RegisterDto } from './dto/auth.dto.js';

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/api/v1',
  maxAge: 8 * 60 * 60 * 1000,
};

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(
    @Body() input: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.register(RegisterDto.validate(input));
    response.cookie(SESSION_COOKIE, result.token, cookieOptions);
    return { user: result.user };
  }

  @Post('login')
  async login(
    @Body() input: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(LoginDto.validate(input));
    response.cookie(SESSION_COOKIE, result.token, cookieOptions);
    return { user: result.user };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie(SESSION_COOKIE, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/v1',
    });
    return { success: true };
  }

  @UseGuards(AuthGuard)
  @Get('me')
  getCurrentUser(@Req() request: AuthenticatedRequest) {
    return { user: request.user };
  }
}
