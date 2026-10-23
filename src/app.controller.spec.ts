import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('GET /', () => {
    it('returns API information', () => {
      const info = appController.getInfo();

      expect(info.name).toBe('ci-cd-learning-api');
      expect(info.version).toBe('1.0.0');
      expect(info.endpoints.health).toBe('GET /health');
      expect(info.endpoints.createTask).toBe('POST /tasks');
    });
  });

  describe('GET /health', () => {
    it('reports a healthy running service', () => {
      const health = appController.getHealth();

      expect(health.status).toBe('ok');
      expect(health.service).toBe('ci-cd-learning-api');
      expect(health.uptimeSeconds).toBeGreaterThanOrEqual(0);
      expect(Number.isNaN(Date.parse(health.timestamp))).toBe(false);
    });
  });
});
