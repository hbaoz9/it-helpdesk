import { BadRequestException } from '@nestjs/common';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class RegisterDto {
  fullName!: string;
  email!: string;
  password!: string;

  static validate(input: unknown): RegisterDto {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new BadRequestException('Invalid registration payload');
    }

    const record = input as Record<string, unknown>;
    if (
      typeof record.fullName !== 'string' ||
      record.fullName.trim().length === 0 ||
      record.fullName.trim().length > 120
    ) {
      throw new BadRequestException(
        'Full name must be between 1 and 120 characters',
      );
    }

    if (
      typeof record.email !== 'string' ||
      !EMAIL_REGEX.test(record.email.trim())
    ) {
      throw new BadRequestException('A valid email is required');
    }

    if (
      typeof record.password !== 'string' ||
      record.password.length < 12 ||
      record.password.length > 128
    ) {
      throw new BadRequestException(
        'Password must be between 12 and 128 characters',
      );
    }

    const dto = new RegisterDto();
    dto.fullName = record.fullName.trim();
    dto.email = record.email.trim().toLowerCase();
    dto.password = record.password;
    return dto;
  }
}

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
