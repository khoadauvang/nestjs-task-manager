import { type ArgumentsHost, Logger, NotFoundException } from '@nestjs/common';
import type { HttpAdapterHost } from '@nestjs/core';
import { QueryFailedError } from 'typeorm';
import { AllExceptionsFilter } from './all-exceptions.filter.js';

describe('AllExceptionsFilter', () => {
  const reply = vi.fn();
  const filter = new AllExceptionsFilter({
    httpAdapter: { reply, getRequestUrl: () => '/api/things' },
  } as unknown as HttpAdapterHost);
  const host = {
    switchToHttp: () => ({ getRequest: () => ({}), getResponse: () => ({}) }),
  } as unknown as ArgumentsHost;

  const pgError = (code: string) =>
    new QueryFailedError(
      'INSERT INTO ...',
      [],
      Object.assign(new Error('db error'), { code }),
    );

  beforeEach(() => {
    reply.mockReset();
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  it('keeps the status and message of HTTP exceptions', () => {
    filter.catch(new NotFoundException('Task not found'), host);
    expect(reply).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        statusCode: 404,
        error: 'Not Found',
        message: 'Task not found',
        path: '/api/things',
      }),
      404,
    );
  });

  it('turns a unique-constraint violation into 409 Conflict', () => {
    filter.catch(pgError('23505'), host);
    expect(reply.mock.calls[0][2]).toBe(409);
  });

  it('turns invalid input syntax into 400', () => {
    filter.catch(pgError('22P02'), host);
    expect(reply.mock.calls[0][2]).toBe(400);
  });

  it('hides the details of unexpected errors', () => {
    filter.catch(new Error('connection string with password'), host);
    const [, body, status] = reply.mock.calls[0] as [
      unknown,
      { message: string },
      number,
    ];
    expect(status).toBe(500);
    expect(body.message).toBe('Internal server error');
  });
});
