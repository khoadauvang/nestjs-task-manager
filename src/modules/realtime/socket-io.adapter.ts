import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { Server, ServerOptions } from 'socket.io';

/**
 * Socket.IO adapter that applies the same CORS origins as the HTTP API.
 * Decorator options (@WebSocketGateway) cannot read ConfigService, an adapter can.
 */
export class SocketIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly corsOrigins: string[],
  ) {
    super(app);
  }

  override createIOServer(port: number, options?: ServerOptions): Server {
    const withCors = {
      ...options,
      cors: { origin: this.corsOrigins, credentials: true },
    } as ServerOptions;
    return super.createIOServer(port, withCors) as Server;
  }
}
