import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { API_PREFIX, configureApp } from './app.setup.js';
import type { Env } from './config/env.schema.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  app.enableShutdownHooks();

  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const port = config.get('PORT', { infer: true });
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`API ready at http://localhost:${port}/${API_PREFIX}`);
  if (config.get('SWAGGER_ENABLED', { infer: true })) {
    logger.log(`Swagger docs at http://localhost:${port}/docs`);
  }
}

await bootstrap();
