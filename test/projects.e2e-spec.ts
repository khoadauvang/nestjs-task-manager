import request from 'supertest';
import {
  createTestApp,
  eventually,
  registerUser,
  type TestApp,
  type TestUser,
} from './utils/test-app.js';

describe('Projects and permissions (e2e)', () => {
  let app: TestApp;
  let owner: TestUser;
  let admin: TestUser;
  let member: TestUser;
  let outsider: TestUser;
  let projectId: string;

  beforeAll(async () => {
    app = await createTestApp();
    owner = await registerUser(app, 'Owner');
    admin = await registerUser(app, 'Admin');
    member = await registerUser(app, 'Member');
    outsider = await registerUser(app, 'Outsider');
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  it('creates a project and makes the creator its owner', async () => {
    const created = await http()
      .post('/api/projects')
      .set(owner.auth)
      .send({ name: '  Website redesign ', description: 'Q4 launch' })
      .expect(201);
    projectId = created.body.data.id;
    expect(created.body.data.name).toBe('Website redesign');

    const list = await http().get('/api/projects').set(owner.auth).expect(200);
    expect(list.body.data).toEqual([
      expect.objectContaining({ id: projectId, role: 'owner' }),
    ]);
    expect(list.body.meta).toEqual({
      page: 1,
      limit: 20,
      totalItems: 1,
      totalPages: 1,
    });
  });

  it('returns a consistent error body for validation errors', async () => {
    const response = await http()
      .post('/api/projects')
      .set(owner.auth)
      .send({})
      .expect(400);
    expect(response.body).toEqual({
      statusCode: 400,
      error: 'Bad Request',
      message: expect.arrayContaining(['name should not be empty']),
      path: '/api/projects',
      timestamp: expect.any(String),
    });
  });

  it('hides projects from non-members with 404 and rejects bad ids with 400', async () => {
    await http()
      .get(`/api/projects/${projectId}`)
      .set(outsider.auth)
      .expect(404);
    await http().get('/api/projects/not-a-uuid').set(owner.auth).expect(400);
  });

  it('lets the owner add members by email', async () => {
    await http()
      .post(`/api/projects/${projectId}/members`)
      .set(owner.auth)
      .send({ email: admin.email, role: 'admin' })
      .expect(201);
    const added = await http()
      .post(`/api/projects/${projectId}/members`)
      .set(owner.auth)
      .send({ email: member.email })
      .expect(201);
    expect(added.body.data).toMatchObject({
      userId: member.id,
      role: 'member',
    });

    await http()
      .post(`/api/projects/${projectId}/members`)
      .set(owner.auth)
      .send({ email: member.email })
      .expect(409);
    await http()
      .post(`/api/projects/${projectId}/members`)
      .set(owner.auth)
      .send({ email: 'nobody@example.com' })
      .expect(404);
    // Ownership cannot be handed out through this endpoint.
    await http()
      .post(`/api/projects/${projectId}/members`)
      .set(owner.auth)
      .send({ email: outsider.email, role: 'owner' })
      .expect(400);
  });

  it('notifies a user who is added to a project', async () => {
    const notifications = await eventually(async () => {
      const response = await http()
        .get('/api/notifications')
        .set(member.auth)
        .expect(200);
      expect(response.body.data).toHaveLength(1);
      return response.body.data;
    });
    expect(notifications[0]).toMatchObject({
      type: 'added_to_project',
      readAt: null,
      data: { projectId, projectName: 'Website redesign', role: 'member' },
    });
  });

  it('enforces project roles', async () => {
    const project = await http()
      .get(`/api/projects/${projectId}`)
      .set(member.auth)
      .expect(200);
    expect(project.body.data.members).toHaveLength(3);

    await http()
      .patch(`/api/projects/${projectId}`)
      .set(member.auth)
      .send({ name: 'Hijacked' })
      .expect(403);
    const renamed = await http()
      .patch(`/api/projects/${projectId}`)
      .set(admin.auth)
      .send({ name: 'Website v2' })
      .expect(200);
    expect(renamed.body.data.name).toBe('Website v2');

    // Only the owner may change roles or delete the project.
    await http()
      .patch(`/api/projects/${projectId}/members/${member.id}`)
      .set(admin.auth)
      .send({ role: 'admin' })
      .expect(403);
    await http()
      .delete(`/api/projects/${projectId}`)
      .set(admin.auth)
      .expect(403);
  });

  it('applies the member removal rules', async () => {
    // A member cannot remove an admin, nobody can remove the owner.
    await http()
      .delete(`/api/projects/${projectId}/members/${admin.id}`)
      .set(member.auth)
      .expect(403);
    await http()
      .delete(`/api/projects/${projectId}/members/${owner.id}`)
      .set(admin.auth)
      .expect(403);

    // Anyone can leave, and then loses access.
    await http()
      .delete(`/api/projects/${projectId}/members/${member.id}`)
      .set(member.auth)
      .expect(204);
    await http().get(`/api/projects/${projectId}`).set(member.auth).expect(404);
  });

  it('lets the owner delete the project', async () => {
    await http()
      .delete(`/api/projects/${projectId}`)
      .set(owner.auth)
      .expect(204);
    await http().get(`/api/projects/${projectId}`).set(owner.auth).expect(404);
    const list = await http().get('/api/projects').set(owner.auth).expect(200);
    expect(list.body.meta.totalItems).toBe(0);
  });
});
