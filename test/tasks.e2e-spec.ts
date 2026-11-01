import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Response } from 'superagent';
import request from 'supertest';
import { TaskRemindersJob } from '../src/modules/tasks/task-reminders.job.js';
import {
  createTestApp,
  eventually,
  registerUser,
  type TestApp,
  type TestUser,
} from './utils/test-app.js';

// A real 1x1 PNG, so the content-based type check can recognise it.
const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

/** Collects a binary response body into a Buffer. */
const binaryParser = (
  res: Response,
  callback: (error: Error | null, body: Buffer) => void,
): void => {
  const stream = res as unknown as NodeJS.ReadableStream;
  const chunks: Buffer[] = [];
  stream.on('data', (chunk: Buffer) => chunks.push(chunk));
  stream.on('end', () => callback(null, Buffer.concat(chunks)));
};

describe('Tasks, comments, attachments and notifications (e2e)', () => {
  let app: TestApp;
  let owner: TestUser;
  let member: TestUser;
  let outsider: TestUser;
  let projectId: string;
  const taskIds: Record<string, string> = {};

  beforeAll(async () => {
    app = await createTestApp();
    owner = await registerUser(app, 'Owner');
    member = await registerUser(app, 'Member');
    outsider = await registerUser(app, 'Outsider');

    const project = await http()
      .post('/api/projects')
      .set(owner.auth)
      .send({ name: 'Launch' })
      .expect(201);
    projectId = project.body.data.id;
    await http()
      .post(`/api/projects/${projectId}/members`)
      .set(owner.auth)
      .send({ email: member.email })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const tasksUrl = () => `/api/projects/${projectId}/tasks`;

  const notificationsOf = async (user: TestUser) =>
    (await http().get('/api/notifications').set(user.auth).expect(200)).body
      .data as Array<{ type: string; data: Record<string, unknown> }>;

  it('only assigns tasks to project members', async () => {
    const response = await http()
      .post(tasksUrl())
      .set(owner.auth)
      .send({ title: 'Secret task', assigneeId: outsider.id })
      .expect(400);
    expect(response.body.message).toBe(
      'Assignee must be a member of the project',
    );
  });

  it('creates tasks and notifies the assignee', async () => {
    const tasks = [
      { title: 'Write the docs', priority: 'high' },
      { title: 'Fix the 50% discount bug', priority: 'low' },
      {
        title: 'Deploy to staging',
        priority: 'medium',
        status: 'in_progress',
        assigneeId: member.id,
      },
    ];
    for (const task of tasks) {
      const response = await http()
        .post(tasksUrl())
        .set(owner.auth)
        .send(task)
        .expect(201);
      taskIds[task.title] = response.body.data.id;
      expect(response.body.data).not.toHaveProperty('dueReminderSentAt');
    }

    const notifications = await eventually(async () => {
      const list = await notificationsOf(member);
      expect(list.some((n) => n.type === 'task_assigned')).toBe(true);
      return list;
    });
    expect(
      notifications.find((n) => n.type === 'task_assigned')?.data,
    ).toMatchObject({
      projectId,
      taskTitle: 'Deploy to staging',
      assignedById: owner.id,
    });
  });

  it('paginates, filters, searches and sorts', async () => {
    const page = await http()
      .get(tasksUrl())
      .query({ limit: 2 })
      .set(member.auth)
      .expect(200);
    expect(page.body.data).toHaveLength(2);
    expect(page.body.meta).toEqual({
      page: 1,
      limit: 2,
      totalItems: 3,
      totalPages: 2,
    });

    const inProgress = await http()
      .get(tasksUrl())
      .query({ status: 'in_progress' })
      .set(member.auth)
      .expect(200);
    expect(inProgress.body.data.map((t: { title: string }) => t.title)).toEqual(
      ['Deploy to staging'],
    );
    expect(inProgress.body.data[0].assignee).toMatchObject({ id: member.id });

    // "%" is matched literally, not as a wildcard.
    const search = await http()
      .get(tasksUrl())
      .query({ search: '%' })
      .set(member.auth)
      .expect(200);
    expect(search.body.data.map((t: { title: string }) => t.title)).toEqual([
      'Fix the 50% discount bug',
    ]);

    const byPriority = await http()
      .get(tasksUrl())
      .query({ sortBy: 'priority', order: 'desc' })
      .set(member.auth)
      .expect(200);
    expect(
      byPriority.body.data.map((t: { priority: string }) => t.priority),
    ).toEqual(['high', 'medium', 'low']);

    await http()
      .get(tasksUrl())
      .query({ sortBy: 'password_hash' })
      .set(member.auth)
      .expect(400);
    await http()
      .get(tasksUrl())
      .query({ unexpected: 'x' })
      .set(member.auth)
      .expect(400);
  });

  it('blocks access to a task through another project', async () => {
    const otherProject = await http()
      .post('/api/projects')
      .set(outsider.auth)
      .send({ name: 'Unrelated' })
      .expect(201);
    // The outsider is a member of their own project, but the task is not in it.
    await http()
      .get(
        `/api/projects/${otherProject.body.data.id}/tasks/${taskIds['Write the docs']}`,
      )
      .set(outsider.auth)
      .expect(404);
    await http().get(tasksUrl()).set(outsider.auth).expect(404);
  });

  it('lets members update tasks', async () => {
    const response = await http()
      .patch(`${tasksUrl()}/${taskIds['Deploy to staging']}`)
      .set(member.auth)
      .send({ status: 'done' })
      .expect(200);
    expect(response.body.data).toMatchObject({
      status: 'done',
      assigneeId: member.id,
    });
  });

  it('notifies the task creator about new comments', async () => {
    const taskId = taskIds['Write the docs'];
    await http()
      .post(`${tasksUrl()}/${taskId}/comments`)
      .set(member.auth)
      .send({ content: 'I can review this.' })
      .expect(201);

    const comments = await http()
      .get(`${tasksUrl()}/${taskId}/comments`)
      .set(owner.auth)
      .expect(200);
    expect(comments.body.data).toHaveLength(1);
    expect(comments.body.data[0]).toMatchObject({
      content: 'I can review this.',
      author: { id: member.id, name: 'Member' },
    });
    expect(comments.body.data[0].author).not.toHaveProperty('passwordHash');

    await eventually(async () => {
      const list = await notificationsOf(owner);
      expect(list).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'comment_added',
            data: expect.objectContaining({
              taskId,
              authorName: 'Member',
              preview: 'I can review this.',
            }),
          }),
        ]),
      );
    });
  });

  it('marks notifications as read', async () => {
    const before = await http()
      .get('/api/notifications/unread-count')
      .set(owner.auth)
      .expect(200);
    expect(before.body.data.count).toBeGreaterThan(0);

    const marked = await http()
      .patch('/api/notifications/read-all')
      .set(owner.auth)
      .expect(200);
    expect(marked.body.data.updated).toBe(before.body.data.count);

    const after = await http()
      .get('/api/notifications/unread-count')
      .set(owner.auth)
      .expect(200);
    expect(after.body.data.count).toBe(0);
  });

  describe('attachments', () => {
    let attachmentId: string;
    const attachmentsUrl = () =>
      `${tasksUrl()}/${taskIds['Write the docs']}/attachments`;

    it('accepts a real image and keeps a Unicode file name', async () => {
      const response = await http()
        .post(attachmentsUrl())
        .set(owner.auth)
        .attach('file', PNG_BYTES, {
          filename: 'ảnh chụp màn hình.png',
          contentType: 'image/png',
        })
        .expect(201);
      attachmentId = response.body.data.id;
      expect(response.body.data).toMatchObject({
        originalName: 'ảnh chụp màn hình.png',
        mimeType: 'image/png',
        size: PNG_BYTES.length,
      });
      expect(response.body.data).not.toHaveProperty('storageKey');
    });

    it('rejects a file whose content does not match an allowed type', async () => {
      await http()
        .post(attachmentsUrl())
        .set(owner.auth)
        .attach('file', Buffer.from('<script>alert(1)</script>'), {
          filename: 'innocent.png',
          contentType: 'image/png',
        })
        .expect(400);
    });

    it('downloads the file as an attachment', async () => {
      const response = await http()
        .get(`${attachmentsUrl()}/${attachmentId}/download`)
        .set(member.auth)
        .buffer(true)
        .parse(binaryParser)
        .expect(200);
      expect(Buffer.compare(response.body as Buffer, PNG_BYTES)).toBe(0);
      expect(response.headers['content-type']).toBe('image/png');
      expect(response.headers['content-disposition']).toContain(
        `filename*=UTF-8''${encodeURIComponent('ảnh chụp màn hình.png')}`,
      );
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    it('only lets the uploader or a manager delete it', async () => {
      await http()
        .delete(`${attachmentsUrl()}/${attachmentId}`)
        .set(member.auth)
        .expect(403);
      await http()
        .delete(`${attachmentsUrl()}/${attachmentId}`)
        .set(owner.auth)
        .expect(204);
      const list = await http()
        .get(attachmentsUrl())
        .set(owner.auth)
        .expect(200);
      expect(list.body.data).toEqual([]);
    });
  });

  it('sends each due-soon reminder exactly once', async () => {
    const taskId = taskIds['Write the docs'];
    const dueDate = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    await http()
      .patch(`${tasksUrl()}/${taskId}`)
      .set(owner.auth)
      .send({ assigneeId: member.id, dueDate })
      .expect(200);

    const job = app.get(TaskRemindersJob);
    expect(await job.sendDueSoonReminders()).toBe(1);
    expect(await job.sendDueSoonReminders()).toBe(0);

    await eventually(async () => {
      const list = await notificationsOf(member);
      expect(
        list.some(
          (n) => n.type === 'task_due_soon' && n.data.taskId === taskId,
        ),
      ).toBe(true);
    });
  });

  it('deletes a task and its files', async () => {
    const taskId = taskIds['Fix the 50% discount bug'];
    await http()
      .post(`${tasksUrl()}/${taskId}/attachments`)
      .set(owner.auth)
      .attach('file', PNG_BYTES, {
        filename: 'bug.png',
        contentType: 'image/png',
      })
      .expect(201);
    const taskDir = join(process.env.UPLOAD_DIR!, projectId, taskId);
    expect(existsSync(taskDir)).toBe(true);

    // Members cannot delete tasks created by someone else.
    await http().delete(`${tasksUrl()}/${taskId}`).set(member.auth).expect(403);
    await http().delete(`${tasksUrl()}/${taskId}`).set(owner.auth).expect(204);
    await http().get(`${tasksUrl()}/${taskId}`).set(owner.auth).expect(404);
    await eventually(async () => {
      expect(existsSync(taskDir)).toBe(false);
    });
  });
});
