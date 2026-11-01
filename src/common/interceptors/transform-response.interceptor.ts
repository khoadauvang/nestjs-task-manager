import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { map, type Observable } from 'rxjs';
import { Paginated } from '../dto/paginated.js';

/**
 * Wraps every HTTP response body in `{ data }`, or `{ data, meta }` for
 * paginated lists. Files and empty (204) responses pass through untouched.
 */
@Injectable()
export class TransformResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // Global interceptors also run for WebSocket handlers; leave acks as they are.
    if (context.getType() !== 'http') {
      return next.handle();
    }

    return next.handle().pipe(
      map((body: unknown) => {
        if (body === undefined || body instanceof StreamableFile) {
          return body;
        }
        if (body instanceof Paginated) {
          return { data: body.items, meta: body.meta };
        }
        return { data: body };
      }),
    );
  }
}
