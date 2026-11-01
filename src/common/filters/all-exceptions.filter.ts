import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { STATUS_CODES } from 'node:http';
import { QueryFailedError } from 'typeorm';

export interface ErrorResponseBody {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
}

type ErrorDetails = Pick<ErrorResponseBody, 'statusCode' | 'error' | 'message'>;

const errorName = (status: number): string => STATUS_CODES[status] ?? 'Error';

/** PostgreSQL error codes we translate into client errors. */
const PG_UNIQUE_VIOLATION = '23505';
const PG_FOREIGN_KEY_VIOLATION = '23503';
const PG_INVALID_TEXT_REPRESENTATION = '22P02';

/**
 * Turns every error into the same JSON shape. Database constraint errors are
 * mapped to 4xx codes, and unexpected errors never leak internal details.
 *
 * Note: global filters only apply to HTTP. WebSocket errors are handled by
 * Nest's BaseWsExceptionFilter (see RealtimeGateway).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly adapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.adapterHost;
    const ctx = host.switchToHttp();
    const details = this.toErrorDetails(exception);

    if (details.statusCode >= 500) {
      this.logger.error(
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ErrorResponseBody = {
      ...details,
      path: httpAdapter.getRequestUrl(ctx.getRequest()) as string,
      timestamp: new Date().toISOString(),
    };
    httpAdapter.reply(ctx.getResponse(), body, details.statusCode);
  }

  toErrorDetails(exception: unknown): ErrorDetails {
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const response = exception.getResponse();
      if (typeof response === 'string') {
        return { statusCode, error: errorName(statusCode), message: response };
      }
      const { message, error } = response as {
        message?: string | string[];
        error?: string;
      };
      return {
        statusCode,
        error: error ?? errorName(statusCode),
        message: message ?? exception.message,
      };
    }

    if (exception instanceof QueryFailedError) {
      const code = (exception.driverError as { code?: string } | undefined)
        ?.code;
      switch (code) {
        case PG_UNIQUE_VIOLATION:
          return this.clientError(
            HttpStatus.CONFLICT,
            'A resource with the same unique value already exists',
          );
        case PG_FOREIGN_KEY_VIOLATION:
          return this.clientError(
            HttpStatus.CONFLICT,
            'The operation conflicts with a related resource',
          );
        case PG_INVALID_TEXT_REPRESENTATION:
          return this.clientError(
            HttpStatus.BAD_REQUEST,
            'Invalid input syntax',
          );
      }
    }

    return this.clientError(
      HttpStatus.INTERNAL_SERVER_ERROR,
      'Internal server error',
    );
  }

  private clientError(statusCode: number, message: string): ErrorDetails {
    return { statusCode, error: errorName(statusCode), message };
  }
}
