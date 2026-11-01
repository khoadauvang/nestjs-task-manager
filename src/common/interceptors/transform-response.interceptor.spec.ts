import { type ExecutionContext, StreamableFile } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { Paginated } from '../dto/paginated.js';
import { TransformResponseInterceptor } from './transform-response.interceptor.js';

describe('TransformResponseInterceptor', () => {
  const interceptor = new TransformResponseInterceptor();
  const contextOf = (type: string) =>
    ({ getType: () => type }) as unknown as ExecutionContext;
  const run = (body: unknown, type = 'http') =>
    lastValueFrom(
      interceptor.intercept(contextOf(type), { handle: () => of(body) }),
    );

  it('wraps a body in { data }', async () => {
    await expect(run({ id: 1 })).resolves.toEqual({ data: { id: 1 } });
  });

  it('turns a Paginated result into { data, meta }', async () => {
    const page = Paginated.of(['a', 'b'], 5, { page: 1, limit: 2 });
    await expect(run(page)).resolves.toEqual({
      data: ['a', 'b'],
      meta: { page: 1, limit: 2, totalItems: 5, totalPages: 3 },
    });
  });

  it('leaves files, empty responses and WebSocket acks untouched', async () => {
    const file = new StreamableFile(Buffer.from('x'));
    await expect(run(file)).resolves.toBe(file);
    await expect(run(undefined)).resolves.toBeUndefined();
    await expect(run({ joined: 'p1' }, 'ws')).resolves.toEqual({
      joined: 'p1',
    });
  });
});
