import { Controller, Get } from '@nestjs/common';
import {
  HealthService,
  type HealthStatusResponse,
  type ReadinessStatusResponse,
} from './health.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  getHealth(): HealthStatusResponse {
    return this.healthService.checkHealth();
  }

  @Get('ready')
  async getReadiness(): Promise<ReadinessStatusResponse> {
    return this.healthService.checkReadiness();
  }
}
