import { JwtService } from '@nestjs/jwt';
import { EntityManager, Repository } from 'typeorm';
import { User } from '../../../database/entities/user.entity';
import { AccessTokenService } from '../access-token.service';

describe('AccessTokenService', () => {
  const jwtService = new JwtService({
    secret: 'test-secret',
    signOptions: { expiresIn: '14d' },
  });

  function makeService(sessionVersion: number | null) {
    const row =
      sessionVersion === null ? null : { id: 'user-1', sessionVersion };
    const users = {
      findOne: jest.fn().mockResolvedValue(row),
      findOneOrFail: jest.fn().mockResolvedValue(row),
    } as unknown as Repository<User>;
    return new AccessTokenService(jwtService, users);
  }

  it("signs the user's current session version into the token", async () => {
    const token = await makeService(3).sign('user-1');

    expect(jwtService.verify(token)).toEqual(
      expect.objectContaining({ sub: 'user-1', sv: 3 }),
    );
  });

  it('accepts a token whose session version is still current', async () => {
    const service = makeService(3);
    const token = await service.sign('user-1');

    await expect(service.verify(token)).resolves.toBe('user-1');
  });

  it('rejects a token issued before the session version was bumped', async () => {
    const token = await makeService(3).sign('user-1');

    await expect(makeService(4).verify(token)).resolves.toBeNull();
  });

  it('treats a token issued before session versions existed as version 0', async () => {
    const legacyToken = jwtService.sign({ sub: 'user-1' });

    await expect(makeService(0).verify(legacyToken)).resolves.toBe('user-1');
    await expect(makeService(1).verify(legacyToken)).resolves.toBeNull();
  });

  it('rejects a token for a user that no longer exists', async () => {
    const token = await makeService(0).sign('user-1');

    await expect(makeService(null).verify(token)).resolves.toBeNull();
  });

  it('rejects a token with a bad signature without touching the database', async () => {
    const forged = new JwtService({ secret: 'other-secret' }).sign({
      sub: 'user-1',
      sv: 0,
    });
    const findOne = jest.fn();
    const users = { findOne } as unknown as Repository<User>;
    const service = new AccessTokenService(jwtService, users);

    await expect(service.verify(forged)).resolves.toBeNull();
    expect(findOne).not.toHaveBeenCalled();
  });

  it('ends all sessions by atomically incrementing the session version', async () => {
    const increment = jest.fn().mockResolvedValue(undefined);
    const manager = { increment } as unknown as EntityManager;

    await makeService(0).endAllSessions(manager, 'user-1');

    expect(increment).toHaveBeenCalledWith(
      User,
      { id: 'user-1' },
      'sessionVersion',
      1,
    );
  });
});
