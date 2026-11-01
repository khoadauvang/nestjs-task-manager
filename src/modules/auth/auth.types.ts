import type { User } from '../users/entities/user.entity.js';

export interface AccessTokenPayload {
  sub: string;
  email: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  /** Access token lifetime in seconds. */
  expiresIn: number;
}

export interface AuthResult {
  user: User;
  tokens: AuthTokens;
}
