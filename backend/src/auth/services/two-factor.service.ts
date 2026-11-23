import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  IsNull,
  LessThan,
  MoreThan,
  Repository,
} from 'typeorm';
import { AuditLogService } from '../../audit-log/services/audit-log.service';
import { hashToken } from '../../common/hash-token.util';
import {
  RECOVERY_CODE_COUNT,
  generateRecoveryCode,
  normalizeRecoveryCode,
} from '../../common/recovery-codes.util';
import {
  buildOtpauthUrl,
  generateTotpSecret,
  matchTotp,
} from '../../common/totp.util';
import { TwoFactorRecoveryCode } from '../../database/entities/two-factor-recovery-code.entity';
import { TwoFactorTrustedBrowser } from '../../database/entities/two-factor-trusted-browser.entity';
import { User } from '../../database/entities/user.entity';
import { LoginAttemptTracker } from './login-attempt-tracker.service';
import { TokenService } from './token.service';
import { TwoFactorSecretCipher } from './two-factor-secret-cipher.service';

const ISSUER = 'Hi Day';
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
/** The httpOnly cookie a browser keeps once told "don't ask again". */
export const TRUSTED_BROWSER_COOKIE = 'two_factor_trusted_browser';
export const TRUSTED_BROWSER_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const WRONG_CODE_MESSAGE =
  "That code didn't work. Check your app and try again.";
const TOO_MANY_WRONG_CODES_MESSAGE =
  'Too many wrong codes. Wait 15 minutes and try again.';

export interface TwoFactorStatus {
  enabled: boolean;
  /** Unused recovery codes left; 0 while two-step login is off. */
  recoveryCodesRemaining: number;
  /** Browsers that skip the code step ("don't ask again"); 0 while off. */
  trustedBrowsers: number;
}

export interface TwoFactorSetup {
  /** For typing in by hand when the QR code can't be scanned. */
  secret: string;
  /** What the QR code encodes. */
  otpauthUrl: string;
}

export type CodeCheck = { ok: true; usedRecoveryCode: boolean } | { ok: false };

/**
 * Two-step login with an authenticator app (ADR 0038): setting it up,
 * checking codes, recovery codes, and the short-lived challenge that sits
 * between a correct password and a session. Signing in itself stays in
 * `AuthService`.
 *
 * Every wrong code counts against the same per-email `LoginAttemptTracker`
 * as a wrong password, so guessing codes is limited exactly like guessing
 * passwords.
 */
@Injectable()
export class TwoFactorService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(TwoFactorRecoveryCode)
    private readonly recoveryCodes: Repository<TwoFactorRecoveryCode>,
    @InjectRepository(TwoFactorTrustedBrowser)
    private readonly trustedBrowsers: Repository<TwoFactorTrustedBrowser>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly cipher: TwoFactorSecretCipher,
    private readonly tokenService: TokenService,
    private readonly loginAttemptTracker: LoginAttemptTracker,
    private readonly auditLogService: AuditLogService,
  ) {}

  isEnabled(user: Pick<User, 'twoFactorEnabledAt'>): boolean {
    return user.twoFactorEnabledAt != null;
  }

  async getStatus(userId: string): Promise<TwoFactorStatus> {
    const user = await this.users.findOneOrFail({ where: { id: userId } });
    if (!this.isEnabled(user)) {
      return { enabled: false, recoveryCodesRemaining: 0, trustedBrowsers: 0 };
    }
    const recoveryCodesRemaining = await this.recoveryCodes.count({
      where: { userId, usedAt: IsNull() },
    });
    const trustedBrowsers = await this.trustedBrowsers.count({
      where: { userId, expiresAt: MoreThan(new Date()) },
    });
    return { enabled: true, recoveryCodesRemaining, trustedBrowsers };
  }

  /**
   * The secret to scan. It only takes effect once `confirmSetup` sees a
   * code from it, so scanning and walking away changes nothing.
   *
   * A setup already under way hands back the same secret rather than a
   * new one. Two requests can arrive together (a double click, or React
   * running the opening effect twice in development), and if each made
   * its own secret the QR code could show one while the other was kept,
   * so no code from the app would ever match. Only the first write wins,
   * and everyone reads back what it stored.
   */
  async beginSetup(userId: string): Promise<TwoFactorSetup> {
    const user = await this.users.findOneOrFail({ where: { id: userId } });
    if (this.isEnabled(user)) {
      throw new ConflictException('Two-step login is already on.');
    }

    await this.users
      .createQueryBuilder()
      .update(User)
      .set({
        twoFactorPendingSecret: this.cipher.encrypt(generateTotpSecret()),
      })
      .where('id = :id', { id: userId })
      .andWhere('"twoFactorPendingSecret" IS NULL')
      .execute();

    const { twoFactorPendingSecret } = await this.users.findOneOrFail({
      where: { id: userId },
      select: { id: true, twoFactorPendingSecret: true },
    });
    const secret = this.cipher.decrypt(twoFactorPendingSecret!);

    return { secret, otpauthUrl: buildOtpauthUrl(secret, user.email, ISSUER) };
  }

  /** Turns it on and returns the recovery codes, shown this once only. */
  async confirmSetup(userId: string, code: string): Promise<string[]> {
    const user = await this.users.findOneOrFail({ where: { id: userId } });
    if (this.isEnabled(user)) {
      throw new ConflictException('Two-step login is already on.');
    }
    if (!user.twoFactorPendingSecret) {
      throw new UnprocessableEntityException(
        'Setup has expired. Start again to get a new QR code.',
      );
    }

    this.assertNotLockedOut(user.email);
    const secret = this.cipher.decrypt(user.twoFactorPendingSecret);
    const step = matchTotp(secret, normalizeCode(code), Date.now(), null);
    if (step === null) {
      this.refuse(user.email);
    }
    this.loginAttemptTracker.reset(user.email);

    return this.dataSource.transaction(async (manager) => {
      await manager.update(User, userId, {
        twoFactorEnabledAt: new Date(),
        twoFactorSecret: user.twoFactorPendingSecret,
        twoFactorPendingSecret: null,
        twoFactorLastUsedStep: step,
      });
      const codes = await this.replaceRecoveryCodes(manager, userId);
      await this.auditLogService.record(manager, {
        action: 'two_factor_enabled',
        actorUserId: userId,
      });
      return codes;
    });
  }

  async disable(userId: string, code: string): Promise<void> {
    const user = await this.requireEnabledUser(userId);
    await this.requireValidCode(user, code);

    await this.dataSource.transaction(async (manager) => {
      await this.clear(manager, userId);
      await this.auditLogService.record(manager, {
        action: 'two_factor_disabled',
        actorUserId: userId,
      });
    });
  }

  /** A fresh set; every earlier code, used or not, stops working. */
  async renewRecoveryCodes(userId: string, code: string): Promise<string[]> {
    const user = await this.requireEnabledUser(userId);
    await this.requireValidCode(user, code);

    return this.dataSource.transaction(async (manager) => {
      const codes = await this.replaceRecoveryCodes(manager, userId);
      await this.auditLogService.record(manager, {
        action: 'two_factor_recovery_codes_renewed',
        actorUserId: userId,
      });
      return codes;
    });
  }

  /**
   * Turns two-step login off without asking for a code. `disable` calls it
   * once the person's code checks out; an admin's reset (for someone who
   * lost both their phone and their recovery codes) calls it directly and
   * records that in the audit log itself.
   */
  async clear(manager: EntityManager, userId: string): Promise<void> {
    await manager.update(User, userId, {
      twoFactorEnabledAt: null,
      twoFactorSecret: null,
      twoFactorPendingSecret: null,
      twoFactorLastUsedStep: null,
      twoFactorChallengeHash: null,
      twoFactorChallengeExpiresAt: null,
    });
    await manager.delete(TwoFactorRecoveryCode, { userId });
    await this.forgetTrustedBrowsers(manager, userId);
  }

  /**
   * Remembers this browser after a right code ("Don't ask again on this
   * browser"): logging in here again within
   * `TRUSTED_BROWSER_TTL_MS` takes only the password. Returns the raw
   * token for the browser's cookie; only its hash is stored. Clears the
   * person's expired rows while it's here, so they don't pile up.
   */
  async trustBrowser(userId: string): Promise<string> {
    const token = this.tokenService.generateToken();
    await this.trustedBrowsers.delete({
      userId,
      expiresAt: LessThan(new Date()),
    });
    await this.trustedBrowsers.save(
      this.trustedBrowsers.create({
        userId,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + TRUSTED_BROWSER_TTL_MS),
      }),
    );
    return token;
  }

  /**
   * Whether the browser's cookie says it was trusted by *this* person and
   * hasn't expired. A cookie left by someone else on a shared computer
   * proves nothing about this account.
   */
  async isTrustedBrowser(
    userId: string,
    token: string | undefined,
  ): Promise<boolean> {
    if (!token) return false;
    return this.trustedBrowsers.exists({
      where: {
        userId,
        tokenHash: hashToken(token),
        expiresAt: MoreThan(new Date()),
      },
    });
  }

  /**
   * Every browser asks for a code again on its next log in. For anything
   * that says the account's login may be in the wrong hands, or changed.
   */
  async forgetTrustedBrowsers(
    manager: EntityManager,
    userId: string,
  ): Promise<void> {
    await manager.delete(TwoFactorTrustedBrowser, { userId });
  }

  /** The account page's "Forget trusted browsers". */
  async forgetTrustedBrowsersByRequest(userId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await this.forgetTrustedBrowsers(manager, userId);
      await this.auditLogService.record(manager, {
        action: 'two_factor_trusted_browsers_forgotten',
        actorUserId: userId,
      });
    });
  }

  /**
   * A code from the app or an unused recovery code. Either is spent by
   * a match: an app code's step can't be used again, and a recovery code
   * is marked used. Both updates are conditional, so two requests racing
   * with the same code can't both win.
   */
  async checkCode(user: User, rawCode: string): Promise<CodeCheck> {
    const code = normalizeCode(rawCode);

    if (/^\d{6}$/.test(code)) {
      if (!user.twoFactorSecret) return { ok: false };
      const step = matchTotp(
        this.cipher.decrypt(user.twoFactorSecret),
        code,
        Date.now(),
        user.twoFactorLastUsedStep,
      );
      if (step === null) return { ok: false };

      const result = await this.users
        .createQueryBuilder()
        .update(User)
        .set({ twoFactorLastUsedStep: step })
        .where('id = :id', { id: user.id })
        .andWhere(
          '("twoFactorLastUsedStep" IS NULL OR "twoFactorLastUsedStep" < :step)',
          { step },
        )
        .execute();
      return result.affected
        ? { ok: true, usedRecoveryCode: false }
        : { ok: false };
    }

    const normalized = normalizeRecoveryCode(code);
    if (!normalized) return { ok: false };
    const result = await this.recoveryCodes.update(
      { userId: user.id, codeHash: hashToken(normalized), usedAt: IsNull() },
      { usedAt: new Date() },
    );
    return result.affected
      ? { ok: true, usedRecoveryCode: true }
      : { ok: false };
  }

  /** The raw token for the browser's cookie; only its hash is stored. */
  async startChallenge(userId: string): Promise<string> {
    const token = this.tokenService.generateToken();
    await this.users.update(userId, {
      twoFactorChallengeHash: hashToken(token),
      twoFactorChallengeExpiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
    });
    return token;
  }

  async findChallengeOwner(token: string): Promise<User | null> {
    return this.users.findOne({
      where: {
        twoFactorChallengeHash: hashToken(token),
        twoFactorChallengeExpiresAt: MoreThan(new Date()),
      },
    });
  }

  async endChallenge(userId: string): Promise<void> {
    await this.users.update(userId, {
      twoFactorChallengeHash: null,
      twoFactorChallengeExpiresAt: null,
    });
  }

  private async requireEnabledUser(userId: string): Promise<User> {
    const user = await this.users.findOneOrFail({ where: { id: userId } });
    if (!this.isEnabled(user)) {
      throw new ConflictException('Two-step login is already off.');
    }
    return user;
  }

  /** For changes made while signed in; throws rather than reporting. */
  private async requireValidCode(user: User, code: string): Promise<void> {
    this.assertNotLockedOut(user.email);
    const check = await this.checkCode(user, code);
    if (!check.ok) {
      this.refuse(user.email);
    }
    this.loginAttemptTracker.reset(user.email);
  }

  private assertNotLockedOut(email: string): void {
    if (this.loginAttemptTracker.requiresCaptcha(email)) {
      throw new HttpException(
        TOO_MANY_WRONG_CODES_MESSAGE,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private refuse(email: string): never {
    this.loginAttemptTracker.recordFailure(email);
    throw new UnprocessableEntityException(WRONG_CODE_MESSAGE);
  }

  private async replaceRecoveryCodes(
    manager: EntityManager,
    userId: string,
  ): Promise<string[]> {
    await manager.delete(TwoFactorRecoveryCode, { userId });
    const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () =>
      generateRecoveryCode(),
    );
    await manager.save(
      codes.map((code) =>
        manager.create(TwoFactorRecoveryCode, {
          userId,
          codeHash: hashToken(normalizeRecoveryCode(code)),
          usedAt: null,
        }),
      ),
    );
    return codes;
  }
}

/** People paste codes with spaces ("123 456") or around them. */
function normalizeCode(code: string): string {
  const trimmed = code.trim();
  const digitsOnly = trimmed.replace(/\s/g, '');
  return /^\d+$/.test(digitsOnly) ? digitsOnly : trimmed;
}
