import { ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';

describe('HealthModule', () => {
  let healthController: HealthController;
  let healthService: HealthService;
  let prismaMock: { $queryRaw: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    prismaMock = {
      $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    healthController = moduleRef.get<HealthController>(HealthController);
    healthService = moduleRef.get<HealthService>(HealthService);
  });

  describe('GET /health', () => {
    it('should return ok status and ISO timestamp', () => {
      const result = healthController.getHealth();

      expect(result.status).toBe('ok');
      expect(typeof result.timestamp).toBe('string');
      expect(Number.isNaN(Date.parse(result.timestamp))).toBe(false);
    });
  });

  describe('GET /health/ready', () => {
    it('should return ok status and database up when database query succeeds', async () => {
      const result = await healthController.getReadiness();

      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        status: 'ok',
        database: 'up',
        timestamp: expect.any(String),
      });
      expect(Number.isNaN(Date.parse(result.timestamp))).toBe(false);
    });

    it('should throw ServiceUnavailableException without leaking sensitive details when database fails', async () => {
      prismaMock.$queryRaw.mockRejectedValueOnce(
        new Error(
          'Connection failed for postgresql://helpdesk:secret_pass@127.0.0.1:5433/it_helpdesk',
        ),
      );

      await expect(healthService.checkReadiness()).rejects.toThrow(
        ServiceUnavailableException,
      );

      try {
        prismaMock.$queryRaw.mockRejectedValueOnce(
          new Error(
            'Connection failed for postgresql://helpdesk:secret_pass@127.0.0.1:5433/it_helpdesk',
          ),
        );
        await healthController.getReadiness();
      } catch (error) {
        expect(error).toBeInstanceOf(ServiceUnavailableException);
        const response = (
          error as ServiceUnavailableException
        ).getResponse() as Record<string, unknown>;
        expect(response).toEqual({
          status: 'error',
          database: 'down',
          timestamp: expect.any(String),
        });
        expect(JSON.stringify(response)).not.toContain('secret_pass');
        expect(JSON.stringify(response)).not.toContain('postgresql://');
      }
    });
  });
});
