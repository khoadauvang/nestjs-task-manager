import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { Env } from '../../config/env.schema.js';
import { UsersModule } from '../users/users.module.js';
import { AccessTokenService } from './access-token.service.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { RefreshToken } from './entities/refresh-token.entity.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { RefreshTokensService } from './refresh-tokens.service.js';
import { TokenCleanupJob } from './token-cleanup.job.js';

@Module({
  imports: [
    UsersModule,
    TypeOrmModule.forFeature([RefreshToken]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_ACCESS_SECRET', { infer: true }),
        signOptions: {
          algorithm: 'HS256',
          expiresIn: config.get('JWT_ACCESS_TTL_SECONDS', { infer: true }),
        },
        // Pin the algorithm so a token cannot choose how it is verified.
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AccessTokenService,
    RefreshTokensService,
    TokenCleanupJob,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [AccessTokenService],
})
export class AuthModule {}
