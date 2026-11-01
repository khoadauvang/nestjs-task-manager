import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Env } from '../../config/env.schema.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import type { AccessTokenPayload } from './auth.types.js';

/** Signs and verifies short-lived JWT access tokens (HTTP and WebSocket). */
@Injectable()
export class AccessTokenService {
  readonly expiresInSeconds: number;

  constructor(
    private readonly jwt: JwtService,
    config: ConfigService<Env, true>,
  ) {
    this.expiresInSeconds = config.get('JWT_ACCESS_TTL_SECONDS', {
      infer: true,
    });
  }

  sign(user: { id: string; email: string }): Promise<string> {
    const payload: AccessTokenPayload = { sub: user.id, email: user.email };
    return this.jwt.signAsync(payload);
  }

  async verify(token: string): Promise<AuthUser> {
    let payload: Partial<AccessTokenPayload>;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
    if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') {
      throw new UnauthorizedException('Invalid access token payload');
    }
    return { id: payload.sub, email: payload.email };
  }
}
