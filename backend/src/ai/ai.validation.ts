import { BadGatewayException, BadRequestException } from '@nestjs/common';
import type { AiAssistResult } from './ai.types.js';

const CREDENTIAL_PATTERN = /(?:\b(?:password|passwd|token|api[_ -]?key|secret)\b|mật khẩu)\s*[:=]\s*\S+|\bBearer\s+\S+|\bsk-[A-Za-z0-9_-]{12,}/i;

export function validateAssistInput(input: unknown): string {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new BadRequestException('Dữ liệu yêu cầu AI không hợp lệ.');
  }
  const record = input as Record<string, unknown>;
  if (Object.keys(record).length !== 1 || typeof record.description !== 'string') {
    throw new BadRequestException('Chỉ chấp nhận mô tả sự cố dạng văn bản.');
  }
  const description = record.description.trim();
  if (description.length < 20 || description.length > 2000) {
    throw new BadRequestException('Mô tả cần từ 20 đến 2000 ký tự.');
  }
  if (Buffer.byteLength(JSON.stringify(input), 'utf8') > 8192) {
    throw new BadRequestException('Dữ liệu yêu cầu AI quá lớn.');
  }
  if (CREDENTIAL_PATTERN.test(description)) {
    throw new BadRequestException('Vui lòng xóa mật khẩu, token và API key trước khi dùng AI.');
  }
  return description;
}

export function parseAssistResult(value: unknown): AiAssistResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadGatewayException('AI trả về kết quả không hợp lệ. Vui lòng thử lại.');
  }
  const record = value as Record<string, unknown>;
  const limits = {
    summary: 500,
    suggestedTitle: 150,
    suggestedDescription: 1500,
    escalationAdvice: 500,
  } as const;
  const result = {} as AiAssistResult;
  for (const [key, max] of Object.entries(limits)) {
    const field = record[key];
    const min = key === 'suggestedTitle' ? 10 : key === 'suggestedDescription' ? 15 : 1;
    if (typeof field !== 'string' || field.trim().length < min || field.trim().length > max) {
      throw new BadGatewayException('AI trả về kết quả không hợp lệ. Vui lòng thử lại.');
    }
    result[key as keyof typeof limits] = field.trim();
  }
  if (!Array.isArray(record.quickChecks) || record.quickChecks.length < 2 || record.quickChecks.length > 4 ||
      !record.quickChecks.every((step) => typeof step === 'string' && step.trim().length > 0 && step.trim().length <= 300)) {
    throw new BadGatewayException('AI trả về kết quả không hợp lệ. Vui lòng thử lại.');
  }
  result.quickChecks = record.quickChecks.map((step: string) => step.trim());
  return result;
}
