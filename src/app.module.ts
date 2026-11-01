import {
  ClassSerializerInterceptor,
  Module,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { TransformResponseInterceptor } from './common/interceptors/transform-response.interceptor.js';
import { type Env, validateEnv } from './config/env.schema.js';
import { buildDataSourceOptions } from './database/typeorm.config.js';
import { AttachmentsModule } from './modules/attachments/attachments.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CommentsModule } from './modules/comments/comments.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { ProjectsModule } from './modules/projects/projects.module.js';
import { RealtimeModule } from './modules/realtime/realtime.module.js';
import { TasksModule } from './modules/tasks/tasks.module.js';
import { UsersModule } from './modules/users/users.module.js';

@Module({
  imports: [
    // Fails fast at startup if an environment variable is missing or invalid.
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        buildDataSourceOptions({
          DB_HOST: config.get('DB_HOST', { infer: true }),
          DB_PORT: config.get('DB_PORT', { infer: true }),
          DB_USER: config.get('DB_USER', { infer: true }),
          DB_PASSWORD: config.get('DB_PASSWORD', { infer: true }),
          DB_NAME: config.get('DB_NAME', { infer: true }),
          DB_LOGGING: config.get('DB_LOGGING', { infer: true }),
          DB_RUN_MIGRATIONS: config.get('DB_RUN_MIGRATIONS', { infer: true }),
          DB_DROP_SCHEMA: config.get('DB_DROP_SCHEMA', { infer: true }),
        }),
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 100 }],
      // Global guards also run for WebSocket messages; only throttle HTTP.
      skipIf: (context) => context.getType() !== 'http',
    }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    HealthModule,
    UsersModule,
    AuthModule,
    ProjectsModule,
    TasksModule,
    CommentsModule,
    AttachmentsModule,
    NotificationsModule,
    RealtimeModule,
  ],
  providers: [
    {
      provide: APP_PIPE,
      useFactory: () =>
        new ValidationPipe({
          whitelist: true, // strip properties without decorators
          forbidNonWhitelisted: true, // ...and reject requests that send them
          transform: true, // plain JSON -> DTO instances (enables @Type, defaults)
        }),
    },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    // Registered first = outermost: serializes after the body is wrapped.
    { provide: APP_INTERCEPTOR, useClass: ClassSerializerInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TransformResponseInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
