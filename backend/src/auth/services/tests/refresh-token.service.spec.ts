import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EntityManager } from 'typeorm';
import { RefreshToken } from '../../../database/entities/refresh-token.entity';
import { RefreshTokenService } from '../refresh-token.service';
import { TokenService } from '../token.service';

describe('RefreshTokenService', () => {
  function makeManager(overrides: Partial<Record<string, jest.Mock>> = {}) {
    const create = jest.fn(
      (_entity: unknown, data: Record<string, unknown>) => data,
    );
    const save = jest.fn().mockResolvedValue(undefined);
    const findOne = jest.fn().mockResolvedValue(null);
    const update = jest.fn().mockResolvedValue(undefined);
    const manager = {
      create,
      save,
      findOne,
      update,
      ...overrides,
    } as unknown as EntityManager;
    return { manager, create, save, findOne, update };
  }

  function makeConfigService() {
    return { get: jest.fn().mockReturnValue(30) } as unknown as ConfigService;
  }

  function makeTokenService() {
    let counter = 0;
    return {
      generateToken: jest.fn(() => `token-${++counter}`),
    } as unknown as TokenService;
  }

  it('issues a hashed refresh token row and returns the opaque token', async () => {
    const { manager, create, save } = makeManager();
    const service = new RefreshTokenService(
      makeConfigService(),
      makeTokenService(),
    );

    const token = await service.issue(manager, 'user-1');

    expect(token).toBe('token-1');
    expect(create).toHaveBeenCalledWith(
      RefreshToken,
      expect.objectContaining({ userId: 'user-1', revokedAt: null }),
    );
    const [, data] = create.mock.calls[0] as [unknown, { tokenHash: string }];
    expect(data.tokenHash).not.toBe('token-1');
    expect(save).toHaveBeenCalled();
  });

  it('rejects rotate() when no matching token row exists', async () => {
    const { manager } = makeManager();
    const service = new RefreshTokenService(
      makeConfigService(),
      makeTokenService(),
    );

    await expect(service.rotate(manager, 'unknown')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects rotate() and revokes all sessions when a revoked token is reused', async () => {
    const existing = {
      id: 'rt-1',
      userId: 'user-1',
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 1000),
    };
    const { manager, update } = makeManager({
      findOne: jest.fn().mockResolvedValue(existing),
    });
    const service = new RefreshTokenService(
      makeConfigService(),
      makeTokenService(),
    );

    await expect(service.rotate(manager, 'stolen')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(update).toHaveBeenCalledWith(
      RefreshToken,
      expect.objectContaining({ userId: 'user-1' }),
      expect.objectContaining({ revokedAt: expect.any(Date) as Date }),
    );
  });

  it('rejects rotate() when the token has expired', async () => {
    const existing = {
      id: 'rt-1',
      userId: 'user-1',
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1000),
    };
    const { manager } = makeManager({
      findOne: jest.fn().mockResolvedValue(existing),
    });
    const service = new RefreshTokenService(
      makeConfigService(),
      makeTokenService(),
    );

    await expect(service.rotate(manager, 'expired')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rotates a valid token: revokes the old row and issues a new one', async () => {
    const existing = {
      id: 'rt-1',
      userId: 'user-1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 1000),
    };
    const { manager, update } = makeManager({
      findOne: jest.fn().mockResolvedValue(existing),
    });
    const service = new RefreshTokenService(
      makeConfigService(),
      makeTokenService(),
    );

    const result = await service.rotate(manager, 'valid');

    expect(update).toHaveBeenCalledWith(
      RefreshToken,
      'rt-1',
      expect.objectContaining({ revokedAt: expect.any(Date) as Date }),
    );
    expect(result).toEqual({ userId: 'user-1', token: 'token-1' });
  });

  it('revokeByValue revokes only the row matching the presented token', async () => {
    const { manager, update } = makeManager();
    const service = new RefreshTokenService(
      makeConfigService(),
      makeTokenService(),
    );

    await service.revokeByValue(manager, 'some-token');

    expect(update).toHaveBeenCalledWith(
      RefreshToken,
      expect.objectContaining({ tokenHash: expect.any(String) as string }),
      expect.objectContaining({ revokedAt: expect.any(Date) as Date }),
    );
  });
});
