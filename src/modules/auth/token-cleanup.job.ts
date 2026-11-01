import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RefreshTokensService } from './refresh-tokens.service.js';

@Injectable()
export class TokenCleanupJob {
  private readonly logger = new Logger(TokenCleanupJob.name);

  constructor(private readonly refreshTokens: RefreshTokensService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM, { name: 'refresh-token-cleanup' })
  async run(): Promise<void> {
    const deleted = await this.refreshTokens.deleteExpired();
    if (deleted > 0) {
      this.logger.log(`Deleted ${deleted} expired refresh token(s)`);
    }
  }
}
