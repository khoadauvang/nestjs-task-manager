import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { IsNull, LessThan, Repository } from 'typeorm';
import type { Env } from '../../config/env.schema.js';
import { RefreshToken } from './entities/refresh-token.entity.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Refresh tokens are random strings, not JWTs. A fast hash (SHA-256) is
 * enough to store them because they carry 256 bits of entropy; slow hashes
 * like bcrypt are for low-entropy passwords.
 */
export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

@Injectable()
export class RefreshTokensService {
  private readonly ttlMs: number;

  constructor(
    @InjectRepository(RefreshToken)
    private readonly tokens: Repository<RefreshToken>,
    config: ConfigService<Env, true>,
  ) {
    this.ttlMs = config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true }) * DAY_MS;
  }

  /** Creates a refresh token. Pass `familyId` to continue an existing login. */
  async issue(
    userId: string,
    familyId: string = randomUUID(),
  ): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    await this.tokens.insert({
      userId,
      familyId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + this.ttlMs),
      revokedAt: null,
    });
    return token;
  }

  /**
   * Exchanges a refresh token for a new one (rotation). Each token works once:
   * presenting an already-used token means it was copied, so every token of
   * that login is revoked.
   */
  async rotate(
    token: string,
  ): Promise<{ userId: string; refreshToken: string }> {
    const existing = await this.tokens.findOneBy({
      tokenHash: hashToken(token),
    });
    if (!existing) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (existing.revokedAt) {
      await this.revokeFamily(existing.familyId);
      throw new UnauthorizedException('Refresh token has already been used');
    }
    if (existing.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    // Conditional update: if two requests rotate the same token at once,
    // only one of them changes the row.
    const claimed = await this.tokens.update(
      { id: existing.id, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
    if (claimed.affected !== 1) {
      await this.revokeFamily(existing.familyId);
      throw new UnauthorizedException('Refresh token has already been used');
    }

    const refreshToken = await this.issue(existing.userId, existing.familyId);
    return { userId: existing.userId, refreshToken };
  }

  /** Logout. Unknown or already revoked tokens are ignored. */
  async revoke(token: string): Promise<void> {
    await this.tokens.update(
      { tokenHash: hashToken(token), revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.tokens.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  /** Expired tokens are useless, so they can be deleted. Returns the count. */
  async deleteExpired(now: Date = new Date()): Promise<number> {
    const result = await this.tokens.delete({ expiresAt: LessThan(now) });
    return result.affected ?? 0;
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.tokens.update(
      { familyId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }
}
