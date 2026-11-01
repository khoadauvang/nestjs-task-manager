import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import type { Repository } from 'typeorm';
import type { ProjectMember } from '../projects/entities/project-member.entity.js';
import type { ProjectMembersService } from '../projects/project-members.service.js';
import { ProjectRole } from '../projects/project-role.enum.js';
import type { Task } from './entities/task.entity.js';
import { TaskEvents } from './task.events.js';
import { TasksService } from './tasks.service.js';

describe('TasksService', () => {
  const repository = {
    create: vi.fn((data: Partial<Task>) => data),
    save: vi.fn(),
    findOne: vi.fn(),
    findOneBy: vi.fn(),
    delete: vi.fn(),
  };
  const members = { isMember: vi.fn() };
  const events = { emit: vi.fn() };
  const service = new TasksService(
    repository as unknown as Repository<Task>,
    members as unknown as ProjectMembersService,
    events as unknown as EventEmitter2,
  );

  const task = (overrides: Partial<Task> = {}): Task =>
    ({
      id: 'task-1',
      projectId: 'project-1',
      title: 'Write docs',
      assigneeId: null,
      createdById: 'creator',
      dueDate: null,
      dueReminderSentAt: new Date('2026-01-01'),
      ...overrides,
    }) as Task;

  beforeEach(() => {
    vi.clearAllMocks();
    repository.save.mockImplementation(async (entity: Task) => entity);
  });

  it('refuses to assign a task to someone outside the project', async () => {
    members.isMember.mockResolvedValue(false);

    await expect(
      service.create('project-1', 'creator', {
        title: 'Secret',
        assigneeId: 'stranger',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('resets the reminder when the due date changes and announces a new assignee', async () => {
    const existing = task();
    repository.findOneBy.mockResolvedValue(existing);
    repository.findOne.mockImplementation(async () => ({ ...existing }));
    members.isMember.mockResolvedValue(true);

    await service.update('project-1', 'task-1', 'creator', {
      dueDate: '2026-12-01T10:00:00.000Z',
      assigneeId: 'teammate',
    });

    const saved = repository.save.mock.calls[0][0] as Task;
    expect(saved.dueReminderSentAt).toBeNull();
    expect(saved.dueDate).toEqual(new Date('2026-12-01T10:00:00.000Z'));
    expect(events.emit).toHaveBeenCalledWith(
      TaskEvents.Assigned,
      expect.objectContaining({
        assigneeId: 'teammate',
        assignedById: 'creator',
      }),
    );
  });

  it('only lets the creator or a manager delete a task', async () => {
    repository.findOneBy.mockResolvedValue(task());
    const member = {
      userId: 'someone',
      role: ProjectRole.MEMBER,
    } as ProjectMember;
    const admin = { userId: 'admin', role: ProjectRole.ADMIN } as ProjectMember;

    await expect(
      service.remove('project-1', 'task-1', member),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await service.remove('project-1', 'task-1', admin);
    expect(repository.delete).toHaveBeenCalledWith({ id: 'task-1' });
    expect(events.emit).toHaveBeenCalledWith(
      TaskEvents.Deleted,
      expect.objectContaining({ taskId: 'task-1', actorId: 'admin' }),
    );
  });
});
