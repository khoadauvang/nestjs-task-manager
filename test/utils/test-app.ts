import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';

export type TestApp = INestApplication;

export async function createTestApp(): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication({ logger: ['error', 'warn'] });
  configureApp(app);
  await app.init();
  return app;
}

export interface TestUser {
  id: string;
  email: string;
  name: string;
  accessToken: string;
  refreshToken: string;
  auth: { Authorization: string };
}

let userCounter = 0;

export async function registerUser(
  app: TestApp,
  name: string,
): Promise<TestUser> {
  userCounter += 1;
  const email = `${name.toLowerCase().replace(/\s+/g, '.')}.${userCounter}.${Date.now()}@example.com`;
  const response = await request(app.getHttpServer())
    .post('/api/auth/register')
    .send({ email, name, password: 'password123' })
    .expect(201);

  const { user, tokens } = response.body.data;
  return {
    id: user.id,
    email,
    name,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    auth: { Authorization: `Bearer ${tokens.accessToken}` },
  };
}

/**
 * Event listeners run after the HTTP response is sent, so their effects
 * (notifications, file cleanup) show up shortly after. Retries `check`
 * until it passes or the timeout is reached.
 */
export async function eventually<T>(
  check: () => Promise<T>,
  timeoutMs = 3000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      return await check();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  throw lastError;
}
