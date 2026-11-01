import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RefreshToken } from './entities/refresh-token.entity.js';
import { hashToken, RefreshTokensService } from './refresh-tokens.service.js';

describe('RefreshTokensService', () => {
  let service: RefreshTokensService;
  const repository = {
    findOneBy: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
  };

  const storedToken = (overrides: Partial<RefreshToken> = {}): RefreshToken =>
    ({
      id: 'token-1',
      userId: 'user-1',
      familyId: 'family-1',
      tokenHash: hashToken('raw-token'),
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      createdAt: new Date(),
      ...overrides,
    }) as RefreshToken;

  beforeEach(async () => {
    vi.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        RefreshTokensService,
        { provide: getRepositoryToken(RefreshToken), useValue: repository },
        { provide: ConfigService, useValue: { get: () => 7 } },
      ],
    }).compile();
    service = moduleRef.get(RefreshTokensService);
  });

  it('stores only a hash of a new token', async () => {
    const token = await service.issue('user-1');

    const [row] = repository.insert.mock.calls[0] as [Partial<RefreshToken>];
    expect(row.tokenHash).toBe(hashToken(token));
    expect(row.tokenHash).not.toBe(token);
    expect(row).toMatchObject({ userId: 'user-1', revokedAt: null });
  });

  it('rotates a valid token and keeps the same family', async () => {
    repository.findOneBy.mockResolvedValue(storedToken());
    repository.update.mockResolvedValue({ affected: 1 });

    const result = await service.rotate('raw-token');

    expect(result.userId).toBe('user-1');
    expect(result.refreshToken).not.toBe('raw-token');
    expect(repository.insert).toHaveBeenCalledWith(
      expect.objectContaining({ familyId: 'family-1' }),
    );
  });

  it('revokes the whole family when a used token is replayed', async () => {
    repository.findOneBy.mockResolvedValue(
      storedToken({ revokedAt: new Date() }),
    );

    await expect(service.rotate('raw-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(repository.update).toHaveBeenCalledWith(
      { familyId: 'family-1', revokedAt: expect.anything() },
      { revokedAt: expect.any(Date) },
    );
    expect(repository.insert).not.toHaveBeenCalled();
  });

  it('treats losing a concurrent rotation as reuse', async () => {
    repository.findOneBy.mockResolvedValue(storedToken());
    repository.update
      .mockResolvedValueOnce({ affected: 0 }) // another request claimed it first
      .mockResolvedValue({ affected: 1 });

    await expect(service.rotate('raw-token')).rejects.toThrow(
      'already been used',
    );
    expect(repository.insert).not.toHaveBeenCalled();
  });

  it('rejects expired and unknown tokens', async () => {
    repository.findOneBy.mockResolvedValueOnce(
      storedToken({ expiresAt: new Date(Date.now() - 1000) }),
    );
    await expect(service.rotate('raw-token')).rejects.toThrow('expired');

    repository.findOneBy.mockResolvedValueOnce(null);
    await expect(service.rotate('raw-token')).rejects.toThrow(
      'Invalid refresh token',
    );
  });
});
