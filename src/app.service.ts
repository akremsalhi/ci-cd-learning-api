import { Injectable } from '@nestjs/common';

export interface AppInfo {
  name: string;
  version: string;
  description: string;
  endpoints: Record<string, string>;
}

export interface HealthStatus {
  status: 'ok';
  service: string;
  version: string;
  uptimeSeconds: number;
  timestamp: string;
}

const SERVICE_NAME = 'ci-cd-learning-api';
const SERVICE_VERSION = '1.0.0';

@Injectable()
export class AppService {
  getInfo(): AppInfo {
    return {
      name: SERVICE_NAME,
      version: SERVICE_VERSION,
      description: 'In-memory tasks API for learning CI/CD.',
      endpoints: {
        info: 'GET /',
        health: 'GET /health',
        createTask: 'POST /tasks',
        listTasks: 'GET /tasks',
        getTask: 'GET /tasks/:id',
        updateTask: 'PATCH /tasks/:id',
        deleteTask: 'DELETE /tasks/:id',
      },
    };
  }

  getHealth(): HealthStatus {
    return {
      status: 'ok',
      service: SERVICE_NAME,
      version: SERVICE_VERSION,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
