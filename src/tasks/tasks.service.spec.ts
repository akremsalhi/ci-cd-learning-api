import { NotFoundException } from '@nestjs/common';
import { TasksService } from './tasks.service.js';

describe('TasksService', () => {
  let service: TasksService;

  beforeEach(() => {
    service = new TasksService();
  });

  it('creates a task with sensible defaults', () => {
    const task = service.create({ title: 'Learn GitHub Actions' });

    expect(task.id).toBeTypeOf('string');
    expect(task.title).toBe('Learn GitHub Actions');
    expect(task.description).toBeUndefined();
    expect(task.completed).toBe(false);
    expect(task.createdAt).toBe(task.updatedAt);
    expect(Number.isNaN(Date.parse(task.createdAt))).toBe(false);
  });

  it('keeps an optional description', () => {
    const task = service.create({
      title: 'Write the pipeline',
      description: 'Lint, test and build on every push.',
    });

    expect(task.description).toBe('Lint, test and build on every push.');
  });

  it('lists every created task', () => {
    const first = service.create({ title: 'First task' });
    const second = service.create({ title: 'Second task' });

    const tasks = service.findAll();

    expect(tasks).toHaveLength(2);
    expect(tasks.map((task) => task.id)).toEqual(
      expect.arrayContaining([first.id, second.id]),
    );
  });

  it('finds a task by id', () => {
    const created = service.create({ title: 'Read the docs' });

    expect(service.findOne(created.id)).toEqual(created);
  });

  it('throws NotFoundException for an unknown id', () => {
    expect(() => service.findOne('missing-id')).toThrow(NotFoundException);
  });

  it('updates only the provided fields and refreshes updatedAt', () => {
    const created = service.create({
      title: 'Old title',
      description: 'Keep me',
    });

    const updated = service.update(created.id, { completed: true });

    expect(updated.id).toBe(created.id);
    expect(updated.title).toBe('Old title');
    expect(updated.description).toBe('Keep me');
    expect(updated.completed).toBe(true);
    expect(updated.createdAt).toBe(created.createdAt);
    expect(updated.updatedAt >= created.updatedAt).toBe(true);
  });

  it('updates the title without dropping the description', () => {
    const created = service.create({
      title: 'Old title',
      description: 'Still here',
    });

    const updated = service.update(created.id, { title: 'New title' });

    expect(updated.title).toBe('New title');
    expect(updated.description).toBe('Still here');
  });

  it('removes a task', () => {
    const created = service.create({ title: 'Temporary task' });

    service.remove(created.id);

    expect(service.findAll()).toHaveLength(0);
    expect(() => service.findOne(created.id)).toThrow(NotFoundException);
  });

  it('throws NotFoundException when removing an unknown task', () => {
    expect(() => service.remove('missing-id')).toThrow(NotFoundException);
  });
});
