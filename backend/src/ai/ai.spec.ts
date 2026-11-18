import { BadGatewayException, BadRequestException, HttpException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import { ApiError, GoogleGenAI } from '@google/genai';
import { AuthService } from '../auth/auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AiModule } from './ai.module.js';
import { AiService } from './ai.service.js';
import { AI_PROVIDER, type AiAssistResult, type AiProvider } from './ai.types.js';
import { parseAssistResult, validateAssistInput } from './ai.validation.js';
import { GeminiProvider } from './gemini.provider.js';

const description = 'Máy tính không kết nối được mạng Wi-Fi của công ty từ sáng nay.';
const validResult: AiAssistResult = {
  summary: 'Máy tính chưa kết nối được Wi-Fi công ty.',
  quickChecks: ['Kiểm tra Wi-Fi đã bật.', 'Thử kết nối lại mạng công ty.'],
  suggestedTitle: 'Không kết nối được Wi-Fi công ty',
  suggestedDescription: 'Máy tính không kết nối được Wi-Fi của công ty từ sáng nay.',
  escalationAdvice: 'Nếu vẫn không kết nối được, hãy liên hệ IT.',
};

describe('AI input and provider response validation', () => {
  it('accepts a Vietnamese description and rejects invalid or sensitive payloads', () => {
    expect(validateAssistInput({ description: `  ${description}  ` })).toBe(description);
    for (const input of [null, { description: 1 }, { description: 'short' }, { description, extra: true },
      { description: `${description} password: abc123` }, { description: 'x'.repeat(2001) }]) {
      expect(() => validateAssistInput(input)).toThrow(BadRequestException);
    }
  });

  it('validates the structured result, including number and size of checks', () => {
    expect(parseAssistResult(validResult)).toEqual(validResult);
    expect(() => parseAssistResult({ ...validResult, quickChecks: ['only one'] })).toThrow(BadGatewayException);
    expect(() => parseAssistResult({ ...validResult, suggestedTitle: 123 })).toThrow(BadGatewayException);
    expect(() => parseAssistResult({ ...validResult, suggestedDescription: 'short' })).toThrow(BadGatewayException);
  });

  it('reports missing provider configuration without fabricating a result', async () => {
    const oldKey = process.env.GEMINI_API_KEY;
    const oldModel = process.env.GEMINI_MODEL;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_MODEL;
    try {
      await expect(new GeminiProvider().assist(description)).rejects.toThrow(ServiceUnavailableException);
    } finally {
      if (oldKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = oldKey;
      if (oldModel === undefined) delete process.env.GEMINI_MODEL; else process.env.GEMINI_MODEL = oldModel;
    }
  });

  it('maps timeout and malformed provider output to explicit errors', async () => {
    const oldKey = process.env.GEMINI_API_KEY;
    const oldModel = process.env.GEMINI_MODEL;
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.GEMINI_MODEL = 'test-model';
    const create = vi.fn();
    class StubProvider extends GeminiProvider {
      protected createClient(): GoogleGenAI {
        return { models: { generateContent: create } } as unknown as GoogleGenAI;
      }
    }
    try {
      create.mockRejectedValueOnce(new ApiError({ status: 504, message: 'deadline exceeded' }));
      await expect(new StubProvider().assist(description)).rejects.toMatchObject({ status: 504 });
      create.mockResolvedValueOnce({ text: '{bad json' });
      await expect(new StubProvider().assist(description)).rejects.toMatchObject({ status: 502 });
      create.mockResolvedValueOnce({ text: JSON.stringify({ ...validResult, quickChecks: [] }) });
      await expect(new StubProvider().assist(description)).rejects.toMatchObject({ status: 502 });
      create.mockRejectedValueOnce(new ApiError({ status: 429, message: 'quota exceeded' }));
      await expect(new StubProvider().assist(description)).rejects.toMatchObject({ status: 429 });
      create.mockRejectedValueOnce(new ApiError({ status: 503, message: 'unavailable' }));
      await expect(new StubProvider().assist(description)).rejects.toMatchObject({ status: 503 });
      create.mockRejectedValueOnce(new Error('internal provider details'));
      await expect(new StubProvider().assist(description)).rejects.toMatchObject({ status: 502 });
      create.mockResolvedValueOnce({ text: JSON.stringify(validResult) });
      await expect(new StubProvider().assist(description)).resolves.toEqual(validResult);
      expect(create).toHaveBeenLastCalledWith(expect.objectContaining({ model: 'test-model', contents: description }));
      delete process.env.GEMINI_MODEL;
      create.mockResolvedValueOnce({ text: JSON.stringify(validResult) });
      await expect(new StubProvider().assist(description)).resolves.toEqual(validResult);
      expect(create).toHaveBeenLastCalledWith(expect.objectContaining({ model: 'gemini-3.8-flash' }));
    } finally {
      if (oldKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = oldKey;
      if (oldModel === undefined) delete process.env.GEMINI_MODEL; else process.env.GEMINI_MODEL = oldModel;
    }
  });

  it('instructs Gemini not to invent completed troubleshooting in a Ticket Draft', async () => {
    const oldKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = 'test-key';
    const generateContent = vi.fn().mockResolvedValue({ text: JSON.stringify(validResult) });
    class StubProvider extends GeminiProvider {
      protected createClient(): GoogleGenAI {
        return { models: { generateContent } } as unknown as GoogleGenAI;
      }
    }
    try {
      await new StubProvider().assist(description);
      expect(generateContent).toHaveBeenCalledWith(expect.objectContaining({ contents: description }));
      for (const rule of [
        'Chỉ coi những điều người dùng nói rõ',
        'Không suy diễn rằng họ đã khởi động lại',
        'Phân biệt rõ thông tin đã biết, thông tin còn thiếu',
        'Không viết các bước đề xuất thành lịch sử xử lý',
      ]) {
        expect(generateContent).toHaveBeenCalledWith(expect.objectContaining({
          config: expect.objectContaining({ systemInstruction: expect.stringContaining(rule) }),
        }));
      }
    } finally {
      if (oldKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = oldKey;
    }
  });
});

describe('AI service and HTTP authorization', () => {
  const assistMock = vi.fn(async () => validResult);
  const provider: AiProvider = { assist: assistMock };
  let app: INestApplication<App>;
  const authenticate = vi.fn(async (token: string) => {
    if (token === 'invalid') throw new UnauthorizedException();
    return { id: token, email: 'test@helpdesk.local', fullName: 'Test', roles: token.split(',') };
  });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AiModule] })
      .overrideProvider(PrismaService).useValue({})
      .overrideProvider(AuthService).useValue({ authenticate })
      .overrideProvider(AI_PROVIDER).useValue(provider)
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => { await app.close(); });

  it('requires a session and only the granted REQUESTER role', async () => {
    await request(app.getHttpServer()).post('/api/v1/ai/assist').send({ description }).expect(401);
    for (const role of ['ADMIN', 'SUPERVISOR', 'TECHNICIAN']) {
      await request(app.getHttpServer()).post('/api/v1/ai/assist')
        .set('Cookie', `it_helpdesk_session=${role}`).send({ description }).expect(403);
    }
    await request(app.getHttpServer()).post('/api/v1/ai/assist')
      .set('Cookie', 'it_helpdesk_session=ADMIN,REQUESTER').send({ description }).expect(200, validResult);
  });

  it('rejects malformed input before calling the provider', async () => {
    assistMock.mockClear();
    await request(app.getHttpServer()).post('/api/v1/ai/assist')
      .set('Cookie', 'it_helpdesk_session=REQUESTER').send({ description: 'short' }).expect(400);
    expect(assistMock).not.toHaveBeenCalled();
  });

  it('limits each requester to ten requests per hour', async () => {
    const service = new AiService(provider);
    for (let index = 0; index < 10; index++) await service.assist('rate-test', description);
    expect(() => service.assist('rate-test', description)).toThrow(HttpException);
  });

  it('propagates provider failure without returning a fake suggestion', async () => {
    assistMock.mockRejectedValueOnce(new HttpException('Provider unavailable', 502));
    await request(app.getHttpServer()).post('/api/v1/ai/assist')
      .set('Cookie', 'it_helpdesk_session=REQUESTER').send({ description }).expect(502);
  });
});
