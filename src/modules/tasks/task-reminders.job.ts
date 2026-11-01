import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, IsNull, Not, Repository } from 'typeorm';
import { Task } from './entities/task.entity.js';
import { TaskStatus } from './task.enums.js';
import { type TaskDueSoonEvent, TaskEvents } from './task.events.js';

const REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class TaskRemindersJob {
  private readonly logger = new Logger(TaskRemindersJob.name);

  constructor(
    @InjectRepository(Task) private readonly tasks: Repository<Task>,
    private readonly events: EventEmitter2,
  ) {}

  @Cron(CronExpression.EVERY_HOUR, { name: 'task-due-reminders' })
  async handleCron(): Promise<void> {
    await this.sendDueSoonReminders();
  }

  /**
   * Reminds assignees of open tasks due within 24 hours.
   *
   * The UPDATE ... RETURNING both finds and marks the tasks in one atomic
   * statement, so a reminder is sent once even if several app instances run
   * this job at the same time.
   */
  async sendDueSoonReminders(now: Date = new Date()): Promise<number> {
    const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_MS);
    const result = await this.tasks.update(
      {
        dueReminderSentAt: IsNull(),
        assigneeId: Not(IsNull()),
        status: Not(TaskStatus.DONE),
        dueDate: Between(now, windowEnd),
      },
      { dueReminderSentAt: now },
      { returning: ['id'] },
    );

    const ids = ((result.raw ?? []) as Array<{ id: string }>).map(
      (row) => row.id,
    );
    if (ids.length === 0) {
      return 0;
    }

    const claimed = await this.tasks.findBy({ id: In(ids) });
    for (const task of claimed) {
      if (!task.assigneeId || !task.dueDate) continue;
      const event: TaskDueSoonEvent = {
        projectId: task.projectId,
        taskId: task.id,
        taskTitle: task.title,
        assigneeId: task.assigneeId,
        dueDate: task.dueDate,
      };
      this.events.emit(TaskEvents.DueSoon, event);
    }
    this.logger.log(`Sent ${claimed.length} due-soon reminder(s)`);
    return claimed.length;
  }
}
