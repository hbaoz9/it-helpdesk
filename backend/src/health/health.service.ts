import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export interface HealthStatusResponse {
  status: 'ok';
  timestamp: string;
}

export interface ReadinessStatusResponse {
  status: 'ok' | 'error';
  database: 'up' | 'down';
  timestamp: string;
}

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  checkHealth(): HealthStatusResponse {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  async checkReadiness(): Promise<ReadinessStatusResponse> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        database: 'up',
        timestamp: new Date().toISOString(),
      };
    } catch {
      const payload: ReadinessStatusResponse = {
        status: 'error',
        database: 'down',
        timestamp: new Date().toISOString(),
      };
      throw new ServiceUnavailableException(payload);
    }
  }
}
