import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import type { Env } from './config/env.schema.js';
import { SocketIoAdapter } from './modules/realtime/socket-io.adapter.js';

export const API_PREFIX = 'api';

/**
 * App-level setup that cannot live in a module. Shared by main.ts and the
 * e2e tests, so the tests run the same configuration as production.
 */
export function configureApp(app: INestApplication): void {
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const corsOrigins = config.get('CORS_ORIGINS', { infer: true });

  app.setGlobalPrefix(API_PREFIX);
  app.use(helmet());
  app.enableCors({ origin: corsOrigins, credentials: true });
  app.useWebSocketAdapter(new SocketIoAdapter(app, corsOrigins));

  if (config.get('SWAGGER_ENABLED', { infer: true })) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Task Manager API')
        .setDescription(
          'Projects, tasks, comments, file attachments and real-time notifications. ' +
            'Successful responses are wrapped as { data } or { data, meta } for lists.',
        )
        .setVersion('0.1.0')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('docs', app, document, {
      jsonDocumentUrl: 'docs/openapi.json',
    });
  }
}
