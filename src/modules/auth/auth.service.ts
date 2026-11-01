import {
  ConflictException,
  Injectable,
  type OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcrypt';
import type { Env } from '../../config/env.schema.js';
import type { User } from '../users/entities/user.entity.js';
import { UsersService } from '../users/users.service.js';
import { AccessTokenService } from './access-token.service.js';
import type { AuthResult, AuthTokens } from './auth.types.js';
import type { LoginDto } from './dto/login.dto.js';
import type { RegisterDto } from './dto/register.dto.js';
import { RefreshTokensService } from './refresh-tokens.service.js';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly bcryptRounds: number;
  /** Compared against when the email does not exist (see login). */
  private dummyHash = '';

  constructor(
    private readonly users: UsersService,
    private readonly accessTokens: AccessTokenService,
    private readonly refreshTokens: RefreshTokensService,
    config: ConfigService<Env, true>,
  ) {
    this.bcryptRounds = config.get('BCRYPT_ROUNDS', { infer: true });
  }

  async onModuleInit(): Promise<void> {
    this.dummyHash = await bcrypt.hash('dummy-password', this.bcryptRounds);
  }

  async register(dto: RegisterDto): Promise<AuthResult> {
    if (await this.users.existsByEmail(dto.email)) {
      throw new ConflictException('Email is already registered');
    }
    const passwordHash = await bcrypt.hash(dto.password, this.bcryptRounds);
    const user = await this.users.create({
      email: dto.email,
      name: dto.name,
      passwordHash,
    });
    return { user, tokens: await this.issueTokens(user) };
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.users.findByEmailWithPassword(dto.email);
    // Always run bcrypt, even for unknown emails, so response times do not
    // reveal which emails are registered.
    const passwordMatches = await bcrypt.compare(
      dto.password,
      user?.passwordHash ?? this.dummyHash,
    );
    if (!user || !passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return { user, tokens: await this.issueTokens(user) };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const rotated = await this.refreshTokens.rotate(refreshToken);
    const user = await this.users.findById(rotated.userId);
    return this.buildTokens(
      await this.accessTokens.sign(user),
      rotated.refreshToken,
    );
  }

  logout(refreshToken: string): Promise<void> {
    return this.refreshTokens.revoke(refreshToken);
  }

  logoutAll(userId: string): Promise<void> {
    return this.refreshTokens.revokeAllForUser(userId);
  }

  private async issueTokens(user: User): Promise<AuthTokens> {
    const [accessToken, refreshToken] = await Promise.all([
      this.accessTokens.sign(user),
      this.refreshTokens.issue(user.id),
    ]);
    return this.buildTokens(accessToken, refreshToken);
  }

  private buildTokens(accessToken: string, refreshToken: string): AuthTokens {
    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.accessTokens.expiresInSeconds,
    };
  }
}
