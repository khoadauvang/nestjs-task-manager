import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator.js';
import type { AuthUser } from '../../../common/types/auth-user.js';
import { AccessTokenService } from '../access-token.service.js';

export function extractBearerToken(header: unknown): string | null {
  if (typeof header !== 'string') {
    return null;
  }
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

/**
 * Registered globally (APP_GUARD in AuthModule): every route needs a valid
 * access token unless it is marked with @Public().
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly accessTokens: AccessTokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Global guards also run for WebSocket messages. Sockets are authenticated
    // once, during the handshake (see RealtimeGateway.afterInit).
    if (context.getType() !== 'http') {
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    const token = extractBearerToken(request.headers.authorization);
    if (!token) {
      throw new UnauthorizedException('Missing access token');
    }
    request.user = await this.accessTokens.verify(token);
    return true;
  }
}
