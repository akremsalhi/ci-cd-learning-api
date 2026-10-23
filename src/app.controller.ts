import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service.js';
import type { AppInfo, HealthStatus } from './app.service.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getInfo(): AppInfo {
    return this.appService.getInfo();
  }

  @Get('health')
  getHealth(): HealthStatus {
    return this.appService.getHealth();
  }
}
