import type { AddressInfo } from 'node:net';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import {
  createTestApp,
  registerUser,
  type TestApp,
  type TestUser,
} from './utils/test-app.js';

function waitFor<T>(
  socket: Socket,
  event: string,
  timeoutMs = 3000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for "${event}"`)),
      timeoutMs,
    );
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

/** Resolves with the events received during `ms`, to assert that nothing arrived. */
function collect(
  socket: Socket,
  event: string,
  ms: number,
): Promise<unknown[]> {
  const received: unknown[] = [];
  const listener = (payload: unknown) => received.push(payload);
  socket.on(event, listener);
  return new Promise((resolve) =>
    setTimeout(() => {
      socket.off(event, listener);
      resolve(received);
    }, ms),
  );
}

describe('Realtime gateway (e2e)', () => {
  let app: TestApp;
  let baseUrl: string;
  let owner: TestUser;
  let member: TestUser;
  let outsider: TestUser;
  let projectId: string;
  let taskId: string;
  const sockets: Socket[] = [];

  const http = () => request(app.getHttpServer());

  const connect = (token?: string): Socket => {
    const socket = io(`${baseUrl}/realtime`, {
      auth: token ? { token } : {},
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
    });
    sockets.push(socket);
    return socket;
  };

  const connected = async (token: string): Promise<Socket> => {
    const socket = connect(token);
    await waitFor(socket, 'connect');
    return socket;
  };

  beforeAll(async () => {
    app = await createTestApp();
    await app.listen(0);
    const { port } = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;

    owner = await registerUser(app, 'Owner');
    member = await registerUser(app, 'Member');
    outsider = await registerUser(app, 'Outsider');

    const project = await http()
      .post('/api/projects')
      .set(owner.auth)
      .send({ name: 'Realtime' })
      .expect(201);
    projectId = project.body.data.id;
    await http()
      .post(`/api/projects/${projectId}/members`)
      .set(owner.auth)
      .send({ email: member.email })
      .expect(201);
    const task = await http()
      .post(`/api/projects/${projectId}/tasks`)
      .set(owner.auth)
      .send({ title: 'Live task' })
      .expect(201);
    taskId = task.body.data.id;
  });

  afterAll(async () => {
    sockets.forEach((socket) => socket.disconnect());
    await app.close();
  });

  it('rejects connections without a valid access token', async () => {
    const anonymous = await waitFor<Error>(connect(), 'connect_error');
    expect(anonymous.message).toBe('Unauthorized');

    const forged = await waitFor<Error>(
      connect('forged.token.value'),
      'connect_error',
    );
    expect(forged.message).toBe('Unauthorized');
  });

  it('only lets members join a project room', async () => {
    const memberSocket = await connected(member.accessToken);
    const ack = await memberSocket.emitWithAck('project:join', { projectId });
    expect(ack).toEqual({ joined: projectId });

    const outsiderSocket = await connected(outsider.accessToken);
    const error = waitFor<{ message: string }>(outsiderSocket, 'exception');
    outsiderSocket.emit('project:join', { projectId });
    expect((await error).message).toBe('Project not found');
  });

  it('pushes task updates to everyone in the project room', async () => {
    const memberSocket = await connected(member.accessToken);
    await memberSocket.emitWithAck('project:join', { projectId });

    const update = waitFor<{
      task: Record<string, unknown>;
      actorId: string;
      changes: string[];
    }>(memberSocket, 'task:updated');
    await http()
      .patch(`/api/projects/${projectId}/tasks/${taskId}`)
      .set(owner.auth)
      .send({ status: 'in_progress' })
      .expect(200);

    const payload = await update;
    expect(payload).toMatchObject({
      task: { id: taskId, status: 'in_progress' },
      actorId: owner.id,
      changes: ['status'],
    });
    expect(payload.task).not.toHaveProperty('dueReminderSentAt');
  });

  it('pushes personal notifications to the user room', async () => {
    const memberSocket = await connected(member.accessToken);
    const notification = waitFor<{ type: string; recipientId: string }>(
      memberSocket,
      'notification:new',
    );

    await http()
      .patch(`/api/projects/${projectId}/tasks/${taskId}`)
      .set(owner.auth)
      .send({ assigneeId: member.id })
      .expect(200);

    expect(await notification).toMatchObject({
      type: 'task_assigned',
      recipientId: member.id,
    });
  });

  it('stops sending project events to a member who was removed', async () => {
    const memberSocket = await connected(member.accessToken);
    await memberSocket.emitWithAck('project:join', { projectId });

    // Control: while still a member, the socket does receive updates.
    const before = waitFor(memberSocket, 'task:updated');
    await http()
      .patch(`/api/projects/${projectId}/tasks/${taskId}`)
      .set(owner.auth)
      .send({ priority: 'high' })
      .expect(200);
    await before;

    await http()
      .delete(`/api/projects/${projectId}/members/${member.id}`)
      .set(owner.auth)
      .expect(204);

    const received = collect(memberSocket, 'task:updated', 500);
    await http()
      .patch(`/api/projects/${projectId}/tasks/${taskId}`)
      .set(owner.auth)
      .send({ title: 'Renamed after removal' })
      .expect(200);
    expect(await received).toEqual([]);
  });
});
