import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { UpdateTaskDto } from './dto/update-task.dto.js';
import { Task } from './entities/task.entity.js';

@Injectable()
export class TasksService {
  private readonly tasks = new Map<string, Task>();

  create(dto: CreateTaskDto): Task {
    const now = new Date().toISOString();
    const task: Task = {
      id: randomUUID(),
      title: dto.title,
      ...(dto.description !== undefined
        ? { description: dto.description }
        : {}),
      completed: false,
      createdAt: now,
      updatedAt: now,
    };

    this.tasks.set(task.id, task);
    return task;
  }

  findAll(): Task[] {
    return [...this.tasks.values()].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  }

  findOne(id: string): Task {
    const task = this.tasks.get(id);

    if (!task) {
      throw new NotFoundException(`Task with id "${id}" was not found`);
    }

    return task;
  }

  update(id: string, dto: UpdateTaskDto): Task {
    const task = this.findOne(id);
    const updated: Task = {
      ...task,
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.description !== undefined
        ? { description: dto.description }
        : {}),
      ...(dto.completed !== undefined ? { completed: dto.completed } : {}),
      updatedAt: new Date().toISOString(),
    };

    this.tasks.set(id, updated);
    return updated;
  }

  remove(id: string): void {
    this.findOne(id);
    this.tasks.delete(id);
  }
}
