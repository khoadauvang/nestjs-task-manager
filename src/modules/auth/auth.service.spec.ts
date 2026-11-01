import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service.js';
import { AccessTokenService } from './access-token.service.js';
import { AuthService } from './auth.service.js';
import { RefreshTokensService } from './refresh-tokens.service.js';

describe('AuthService', () => {
  let service: AuthService;
  const users = {
    existsByEmail: vi.fn(),
    create: vi.fn(),
    findByEmailWithPassword: vi.fn(),
    findById: vi.fn(),
  };
  const accessTokens = { sign: vi.fn(), expiresInSeconds: 900 };
  const refreshTokens = { issue: vi.fn(), rotate: vi.fn() };

  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.resetAllMocks();
    accessTokens.sign.mockResolvedValue('access-token');
    refreshTokens.issue.mockResolvedValue('refresh-token');

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: users },
        { provide: AccessTokenService, useValue: accessTokens },
        { provide: RefreshTokensService, useValue: refreshTokens },
        { provide: ConfigService, useValue: { get: () => 4 } },
      ],
    }).compile();
    await moduleRef.init(); // runs onModuleInit (prepares the dummy hash)
    service = moduleRef.get(AuthService);
  });

  it('hashes the password on register and returns tokens', async () => {
    users.existsByEmail.mockResolvedValue(false);
    users.create.mockImplementation(async (data: object) => ({
      id: 'user-1',
      ...data,
    }));

    const result = await service.register({
      email: 'khoa@example.com',
      name: 'Khoa',
      password: 'password123',
    });

    const { passwordHash } = users.create.mock.calls[0][0] as {
      passwordHash: string;
    };
    expect(passwordHash).not.toBe('password123');
    expect(await bcrypt.compare('password123', passwordHash)).toBe(true);
    expect(result.tokens).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      tokenType: 'Bearer',
      expiresIn: 900,
    });
  });

  it('refuses to register an email twice', async () => {
    users.existsByEmail.mockResolvedValue(true);

    await expect(
      service.register({
        email: 'khoa@example.com',
        name: 'Khoa',
        password: 'password123',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(users.create).not.toHaveBeenCalled();
  });

  it('still runs bcrypt for an unknown email, so timing does not leak it', async () => {
    users.findByEmailWithPassword.mockResolvedValue(null);
    const compare = vi.spyOn(bcrypt, 'compare');

    await expect(
      service.login({ email: 'nobody@example.com', password: 'password123' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(compare).toHaveBeenCalledTimes(1);
  });

  it('logs in with the right password', async () => {
    const passwordHash = await bcrypt.hash('password123', 4);
    users.findByEmailWithPassword.mockResolvedValue({
      id: 'user-1',
      email: 'khoa@example.com',
      passwordHash,
    });

    const result = await service.login({
      email: 'khoa@example.com',
      password: 'password123',
    });
    expect(result.user.id).toBe('user-1');
    await expect(
      service.login({ email: 'khoa@example.com', password: 'wrong-password' }),
    ).rejects.toThrow('Invalid email or password');
  });
});
