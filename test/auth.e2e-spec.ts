import request from 'supertest';
import { createTestApp, type TestApp } from './utils/test-app.js';

describe('Auth (e2e)', () => {
  let app: TestApp;
  const email = 'khoa@example.com';
  const password = 'correct-horse-battery';

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  it('registers a user and never returns the password hash', async () => {
    const response = await http()
      .post('/api/auth/register')
      .send({ email: '  KHOA@Example.com ', name: 'Tran Anh Khoa', password })
      .expect(201);

    const { user, tokens } = response.body.data;
    expect(user).toMatchObject({ email, name: 'Tran Anh Khoa' });
    expect(user).not.toHaveProperty('passwordHash');
    expect(tokens).toMatchObject({ tokenType: 'Bearer', expiresIn: 900 });
    expect(typeof tokens.accessToken).toBe('string');
    expect(typeof tokens.refreshToken).toBe('string');
  });

  it('rejects a duplicate email with 409', async () => {
    const response = await http()
      .post('/api/auth/register')
      .send({ email, name: 'Someone else', password })
      .expect(409);
    expect(response.body).toMatchObject({
      statusCode: 409,
      error: 'Conflict',
      message: 'Email is already registered',
      path: '/api/auth/register',
    });
  });

  it('validates input and rejects unknown fields', async () => {
    const response = await http()
      .post('/api/auth/register')
      .send({
        email: 'not-an-email',
        name: '',
        password: 'short',
        isAdmin: true,
      })
      .expect(400);
    expect(response.body.message).toEqual(
      expect.arrayContaining([
        'property isAdmin should not exist',
        'email must be an email',
        'password must be longer than or equal to 8 characters',
      ]),
    );
  });

  it('logs in, with the same error for a wrong password and an unknown email', async () => {
    const ok = await http()
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);
    expect(ok.body.data.user.email).toBe(email);

    const wrongPassword = await http()
      .post('/api/auth/login')
      .send({ email, password: 'wrong-password' })
      .expect(401);
    const unknownEmail = await http()
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password })
      .expect(401);
    expect(wrongPassword.body.message).toBe('Invalid email or password');
    expect(unknownEmail.body.message).toBe(wrongPassword.body.message);
  });

  it('protects routes with the access token', async () => {
    await http().get('/api/users/me').expect(401);
    await http()
      .get('/api/users/me')
      .set('Authorization', 'Bearer not-a-real-token')
      .expect(401);

    const login = await http()
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);
    const me = await http()
      .get('/api/users/me')
      .set('Authorization', `Bearer ${login.body.data.tokens.accessToken}`)
      .expect(200);
    expect(me.body.data).toMatchObject({ email, name: 'Tran Anh Khoa' });
  });

  it('rotates refresh tokens and revokes the whole login when an old one is reused', async () => {
    const register = await http()
      .post('/api/auth/register')
      .send({ email: 'rotation@example.com', name: 'Rotation', password })
      .expect(201);
    const first: string = register.body.data.tokens.refreshToken;

    const second = await http()
      .post('/api/auth/refresh')
      .send({ refreshToken: first })
      .expect(200);
    const secondToken: string = second.body.data.refreshToken;
    expect(secondToken).not.toBe(first);

    // Replaying the first token looks like theft: it fails...
    await http()
      .post('/api/auth/refresh')
      .send({ refreshToken: first })
      .expect(401);
    // ...and the token issued after it is revoked as well.
    await http()
      .post('/api/auth/refresh')
      .send({ refreshToken: secondToken })
      .expect(401);
  });

  it('logout revokes the refresh token', async () => {
    const login = await http()
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);
    const { refreshToken } = login.body.data.tokens;

    await http().post('/api/auth/logout').send({ refreshToken }).expect(204);
    await http().post('/api/auth/refresh').send({ refreshToken }).expect(401);
  });

  it('rate-limits login attempts', async () => {
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await http()
        .post('/api/auth/login')
        .send({ email, password: 'wrong-password' });
      statuses.push(response.status);
    }
    // Five attempts per minute are allowed; earlier tests already used some.
    expect(statuses).toContain(429);
  });
});
