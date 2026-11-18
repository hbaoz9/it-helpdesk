import { BadRequestException } from '@nestjs/common';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class LoginDto {
  email!: string;
  password!: string;
  remember?: boolean;

  static validate(input: unknown): LoginDto {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new BadRequestException('Invalid login payload');
    }

    const record = input as Record<string, unknown>;
    if (
      typeof record.email !== 'string' ||
      !EMAIL_REGEX.test(record.email.trim()) ||
      typeof record.password !== 'string' ||
      record.password.length === 0
    ) {
      throw new BadRequestException('Email and password are required');
    }

    if (
      record.remember !== undefined &&
      typeof record.remember !== 'boolean'
    ) {
      throw new BadRequestException('Field remember must be a boolean');
    }

    const dto = new LoginDto();
    dto.email = record.email.trim().toLowerCase();
    dto.password = record.password;
    if (record.remember !== undefined) {
      dto.remember = record.remember;
    }
    return dto;
  }
}
