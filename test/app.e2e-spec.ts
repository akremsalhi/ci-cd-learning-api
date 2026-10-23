import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';

interface TaskBody {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

describe('ci-cd-learning-api (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET / returns API information', async () => {
    const response = await request(app.getHttpServer()).get('/').expect(200);

    expect(response.body.name).toBe('ci-cd-learning-api');
    expect(response.body.endpoints.createTask).toBe('POST /tasks');
    expect(response.body.endpoints.listTasks).toBe('GET /tasks');
  });

  it('GET /health returns a healthy response', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);

    expect(response.body.status).toBe('ok');
    expect(response.body.service).toBe('ci-cd-learning-api');
    expect(response.body.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(Number.isNaN(Date.parse(response.body.timestamp))).toBe(false);
  });

  it('supports the full task lifecycle', async () => {
    const created = await request(app.getHttpServer())
      .post('/tasks')
      .send({
        title: '  Learn CI/CD  ',
        description: 'Build the first pipeline.',
      })
      .expect(201);

    const task = created.body as TaskBody;

    expect(task.id).toBeTypeOf('string');
    expect(task.title).toBe('Learn CI/CD');
    expect(task.description).toBe('Build the first pipeline.');
    expect(task.completed).toBe(false);
    expect(task.createdAt).toBe(task.updatedAt);

    const list = await request(app.getHttpServer()).get('/tasks').expect(200);

    expect(list.body).toHaveLength(1);
    expect(list.body[0].id).toBe(task.id);

    const fetched = await request(app.getHttpServer())
      .get(`/tasks/${task.id}`)
      .expect(200);

    expect(fetched.body.title).toBe('Learn CI/CD');

    const updated = await request(app.getHttpServer())
      .patch(`/tasks/${task.id}`)
      .send({ completed: true, title: 'Learn CI/CD properly' })
      .expect(200);

    expect(updated.body.completed).toBe(true);
    expect(updated.body.title).toBe('Learn CI/CD properly');
    expect(updated.body.description).toBe('Build the first pipeline.');
    expect(updated.body.createdAt).toBe(task.createdAt);

    await request(app.getHttpServer()).delete(`/tasks/${task.id}`).expect(204);

    await request(app.getHttpServer()).get(`/tasks/${task.id}`).expect(404);
  });

  it('returns 404 for an unknown task', async () => {
    await request(app.getHttpServer()).get('/tasks/unknown-id').expect(404);

    await request(app.getHttpServer())
      .patch('/tasks/unknown-id')
      .send({ completed: true })
      .expect(404);

    await request(app.getHttpServer()).delete('/tasks/unknown-id').expect(404);
  });

  it('rejects invalid create payloads', async () => {
    await request(app.getHttpServer()).post('/tasks').send({}).expect(400);

    await request(app.getHttpServer())
      .post('/tasks')
      .send({ title: '   ' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/tasks')
      .send({ title: 'Valid title', unexpected: true })
      .expect(400);
  });

  it('rejects invalid update payloads', async () => {
    const created = await request(app.getHttpServer())
      .post('/tasks')
      .send({ title: 'Valid task' })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/tasks/${created.body.id}`)
      .send({ completed: 'yes' })
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/tasks/${created.body.id}`)
      .send({ title: '   ' })
      .expect(400);
  });
});
