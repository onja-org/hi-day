import { randomBytes } from 'crypto';
import {
  ConflictException,
  HttpException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { hashToken } from '../../../common/hash-token.util';
import { generateTotp, totpStepAt } from '../../../common/totp.util';
import { TwoFactorTrustedBrowser } from '../../../database/entities/two-factor-trusted-browser.entity';
import { TwoFactorRecoveryCode } from '../../../database/entities/two-factor-recovery-code.entity';
import { User } from '../../../database/entities/user.entity';
import { LoginAttemptTracker } from '../login-attempt-tracker.service';
import { TwoFactorSecretCipher } from '../two-factor-secret-cipher.service';
import { TwoFactorService } from '../two-factor.service';

const SECRET = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';

describe('TwoFactorService', () => {
  const cipher = new TwoFactorSecretCipher({
    getOrThrow: () => randomBytes(32).toString('base64'),
  } as unknown as ConfigService);

  function currentCode() {
    return generateTotp(SECRET, totpStepAt(Date.now()));
  }

  function setup(userOverrides: Partial<User> = {}) {
    const user = {
      id: 'user-1',
      email: 'jane@acme.test',
      twoFactorEnabledAt: null,
      twoFactorSecret: null,
      twoFactorPendingSecret: null,
      twoFactorLastUsedStep: null,
      ...userOverrides,
    } as User;

    const execute = jest.fn().mockResolvedValue({ affected: 1 });
    const queryBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute,
    };
    const users = {
      findOneOrFail: jest.fn().mockResolvedValue(user),
      findOne: jest.fn().mockResolvedValue(user),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn(() => queryBuilder),
    } as unknown as Repository<User>;

    const recoveryCodeUpdate = jest.fn().mockResolvedValue({ affected: 0 });
    const recoveryCodes = {
      count: jest.fn().mockResolvedValue(7),
      update: recoveryCodeUpdate,
    } as unknown as Repository<TwoFactorRecoveryCode>;

    const trustedBrowsers = {
      count: jest.fn().mockResolvedValue(2),
      delete: jest.fn().mockResolvedValue({ affected: 0 }),
      save: jest.fn(),
      create: jest.fn((data: unknown) => data),
      exists: jest.fn().mockResolvedValue(false),
    };

    const manager = {
      update: jest.fn(),
      delete: jest.fn(),
      save: jest.fn(),
      create: jest.fn((_entity: unknown, data: unknown) => data),
    };
    const dataSource = {
      transaction: jest.fn((fn: (m: EntityManager) => Promise<unknown>) =>
        fn(manager as unknown as EntityManager),
      ),
    } as unknown as DataSource;

    const tracker = {
      requiresCaptcha: jest.fn().mockReturnValue(false),
      recordFailure: jest.fn(),
      reset: jest.fn(),
    };
    const record = jest.fn();

    const service = new TwoFactorService(
      users,
      recoveryCodes,
      trustedBrowsers as unknown as Repository<TwoFactorTrustedBrowser>,
      dataSource,
      cipher,
      { generateToken: () => 'raw-challenge' },
      tracker as unknown as LoginAttemptTracker,
      { record },
    );

    return {
      service,
      user,
      users,
      queryBuilder,
      manager,
      tracker,
      record,
      execute,
      recoveryCodeUpdate,
      trustedBrowsers,
    };
  }

  describe('setup', () => {
    /** Applies the conditional write the way Postgres would. */
    function storePendingLikeTheDatabase(
      user: User,
      queryBuilder: { set: jest.Mock; execute: jest.Mock },
    ) {
      let pending: string | undefined;
      queryBuilder.set.mockImplementation(
        (values: { twoFactorPendingSecret: string }) => {
          pending = values.twoFactorPendingSecret;
          return queryBuilder;
        },
      );
      queryBuilder.execute.mockImplementation(() => {
        if (user.twoFactorPendingSecret !== null) return { affected: 0 };
        user.twoFactorPendingSecret = pending!;
        return { affected: 1 };
      });
    }

    it('stores a new secret as pending, encrypted, and returns it to scan', async () => {
      const { service, user, queryBuilder } = setup();
      storePendingLikeTheDatabase(user, queryBuilder);

      const result = await service.beginSetup('user-1');

      expect(result.secret).toMatch(/^[A-Z2-7]{32}$/);
      expect(result.otpauthUrl).toContain(`secret=${result.secret}`);
      expect(result.otpauthUrl).toContain('jane%40acme.test');
      expect(user.twoFactorPendingSecret).not.toContain(result.secret);
      expect(cipher.decrypt(user.twoFactorPendingSecret!)).toBe(result.secret);
    });

    it('hands every request the same secret while a setup is under way, so the QR code always matches', async () => {
      const { service, user, queryBuilder } = setup();
      storePendingLikeTheDatabase(user, queryBuilder);

      const [first, second] = await Promise.all([
        service.beginSetup('user-1'),
        service.beginSetup('user-1'),
      ]);
      const reopened = await service.beginSetup('user-1');

      expect(second.secret).toBe(first.secret);
      expect(reopened.secret).toBe(first.secret);
      expect(cipher.decrypt(user.twoFactorPendingSecret!)).toBe(first.secret);
    });

    it('refuses to start again while it is already on', async () => {
      const { service } = setup({ twoFactorEnabledAt: new Date() });
      await expect(service.beginSetup('user-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('turns on with a right code, hands out ten recovery codes and records it', async () => {
      const { service, manager, record } = setup({
        twoFactorPendingSecret: cipher.encrypt(SECRET),
      });

      const codes = await service.confirmSetup('user-1', currentCode());

      expect(codes).toHaveLength(10);
      expect(manager.update).toHaveBeenCalledWith(
        User,
        'user-1',
        expect.objectContaining({
          twoFactorEnabledAt: expect.any(Date) as unknown,
          twoFactorPendingSecret: null,
        }),
      );
      const [[saved]] = manager.save.mock.calls as [[{ codeHash: string }[]]];
      expect(saved.map((row) => row.codeHash)).toEqual(
        codes.map((code) => hashToken(code.replace('-', ''))),
      );
      expect(record).toHaveBeenCalledWith(
        manager,
        expect.objectContaining({ action: 'two_factor_enabled' }),
      );
    });

    it('refuses a wrong code during setup and counts it', async () => {
      const { service, tracker, manager } = setup({
        twoFactorPendingSecret: cipher.encrypt(SECRET),
      });

      await expect(
        service.confirmSetup('user-1', '000000'),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(tracker.recordFailure).toHaveBeenCalledWith('jane@acme.test');
      expect(manager.update).not.toHaveBeenCalled();
    });
  });

  describe('checkCode', () => {
    it('accepts a current app code and marks its step used', async () => {
      const { service, user, execute } = setup({
        twoFactorEnabledAt: new Date(),
        twoFactorSecret: cipher.encrypt(SECRET),
      });

      await expect(service.checkCode(user, currentCode())).resolves.toEqual({
        ok: true,
        usedRecoveryCode: false,
      });
      expect(execute).toHaveBeenCalled();
    });

    it('refuses an app code another request just used', async () => {
      const { service, user, execute } = setup({
        twoFactorEnabledAt: new Date(),
        twoFactorSecret: cipher.encrypt(SECRET),
      });
      execute.mockResolvedValue({ affected: 0 });

      await expect(service.checkCode(user, currentCode())).resolves.toEqual({
        ok: false,
      });
    });

    it('accepts an unused recovery code however it is typed, once', async () => {
      const { service, user, recoveryCodeUpdate } = setup({
        twoFactorEnabledAt: new Date(),
        twoFactorSecret: cipher.encrypt(SECRET),
      });
      recoveryCodeUpdate.mockResolvedValueOnce({ affected: 1 });

      await expect(service.checkCode(user, 'abcde fghjk')).resolves.toEqual({
        ok: true,
        usedRecoveryCode: true,
      });
      expect(recoveryCodeUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          codeHash: hashToken('ABCDEFGHJK'),
        }),
        { usedAt: expect.any(Date) as unknown },
      );

      await expect(service.checkCode(user, 'ABCDE-FGHJK')).resolves.toEqual({
        ok: false,
      });
    });
  });

  describe('turning off and renewing codes', () => {
    it('asks for a code before turning off', async () => {
      const { service, manager, record } = setup({
        twoFactorEnabledAt: new Date(),
        twoFactorSecret: cipher.encrypt(SECRET),
      });

      await expect(service.disable('user-1', '000000')).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      expect(manager.update).not.toHaveBeenCalled();

      await service.disable('user-1', currentCode());
      expect(manager.update).toHaveBeenCalledWith(
        User,
        'user-1',
        expect.objectContaining({
          twoFactorEnabledAt: null,
          twoFactorSecret: null,
        }),
      );
      expect(manager.delete).toHaveBeenCalledWith(TwoFactorRecoveryCode, {
        userId: 'user-1',
      });
      expect(manager.delete).toHaveBeenCalledWith(TwoFactorTrustedBrowser, {
        userId: 'user-1',
      });
      expect(record).toHaveBeenCalledWith(
        manager,
        expect.objectContaining({ action: 'two_factor_disabled' }),
      );
    });

    it('asks for a code before creating new recovery codes, and replaces the old ones', async () => {
      const { service, manager } = setup({
        twoFactorEnabledAt: new Date(),
        twoFactorSecret: cipher.encrypt(SECRET),
      });

      await expect(
        service.renewRecoveryCodes('user-1', '000000'),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);

      const codes = await service.renewRecoveryCodes('user-1', currentCode());
      expect(codes).toHaveLength(10);
      expect(manager.delete).toHaveBeenCalledWith(TwoFactorRecoveryCode, {
        userId: 'user-1',
      });
    });

    it('stops checking codes once wrong ones call for a captcha', async () => {
      const { service, tracker } = setup({
        twoFactorEnabledAt: new Date(),
        twoFactorSecret: cipher.encrypt(SECRET),
      });
      tracker.requiresCaptcha.mockReturnValue(true);

      const error = await service
        .disable('user-1', currentCode())
        .catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(429);
    });
  });

  it('reports how many recovery codes are left and how many browsers skip the code', async () => {
    const { service } = setup({ twoFactorEnabledAt: new Date() });
    await expect(service.getStatus('user-1')).resolves.toEqual({
      enabled: true,
      recoveryCodesRemaining: 7,
      trustedBrowsers: 2,
    });
  });

  describe('trusted browsers', () => {
    it('stores only the hash of the token it hands the browser, for 30 days', async () => {
      const { service, trustedBrowsers } = setup();

      const token = await service.trustBrowser('user-1');

      expect(token).toBe('raw-challenge');
      const [[saved]] = trustedBrowsers.save.mock.calls as [
        [{ userId: string; tokenHash: string; expiresAt: Date }],
      ];
      expect(saved.userId).toBe('user-1');
      expect(saved.tokenHash).toBe(hashToken('raw-challenge'));
      const days = (saved.expiresAt.getTime() - Date.now()) / 86_400_000;
      expect(days).toBeGreaterThan(29.9);
      expect(days).toBeLessThanOrEqual(30);
    });

    it('only trusts a live token belonging to the person logging in', async () => {
      const { service, trustedBrowsers } = setup();
      trustedBrowsers.exists.mockResolvedValue(true);

      await expect(
        service.isTrustedBrowser('user-1', 'the-token'),
      ).resolves.toBe(true);
      expect(trustedBrowsers.exists).toHaveBeenCalledWith({
        where: expect.objectContaining({
          userId: 'user-1',
          tokenHash: hashToken('the-token'),
        }) as unknown,
      });
    });

    it('trusts nothing without a cookie', async () => {
      const { service, trustedBrowsers } = setup();

      await expect(service.isTrustedBrowser('user-1', undefined)).resolves.toBe(
        false,
      );
      expect(trustedBrowsers.exists).not.toHaveBeenCalled();
    });

    it('forgets every browser on request and records it', async () => {
      const { service, manager, record } = setup();

      await service.forgetTrustedBrowsersByRequest('user-1');

      expect(manager.delete).toHaveBeenCalledWith(TwoFactorTrustedBrowser, {
        userId: 'user-1',
      });
      expect(record).toHaveBeenCalledWith(
        manager,
        expect.objectContaining({
          action: 'two_factor_trusted_browsers_forgotten',
        }),
      );
    });
  });
});
