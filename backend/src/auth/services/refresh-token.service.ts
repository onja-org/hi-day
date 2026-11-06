import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EntityManager, IsNull } from 'typeorm';
import { hashToken } from '../../common/hash-token.util';
import { RefreshToken } from '../../database/entities/refresh-token.entity';
import { TokenService } from './token.service';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_REFRESH_TOKEN_TTL_DAYS = 30;
const INVALID_REFRESH_TOKEN_MESSAGE = 'Session expired. Please log in again.';
// Refresh tokens are single-use/rotating, and more than one request can
// legitimately present the same (about-to-be-stale) cookie at once — e.g.
// two requests fired by one page load, or two tabs, right at the access
// token's expiry boundary. Reusing an already-rotated token within this
// window, while its replacement is still untouched, is treated as that
// race rather than theft. Reuse outside the window, or once the
// replacement has itself been used, still revokes every session for the
// user — that's the actual theft signal.
const REUSE_GRACE_MS = 5_000;

export type RefreshTokenRotation =
  | { outcome: 'rotated'; userId: string; token: string }
  /**
   * An already-rotated token came back outside the race window: the
   * theft signal. Nothing is revoked here — the caller ends the user's
   * sessions in a transaction of its own (see `AuthService.refresh`).
   */
  | { outcome: 'reuse_detected'; userId: string };

@Injectable()
export class RefreshTokenService {
  constructor(
    private readonly configService: ConfigService,
    private readonly tokenService: TokenService,
  ) {}

  async issue(manager: EntityManager, userId: string): Promise<string> {
    const token = this.tokenService.generateToken();
    const ttlDays = Number(
      this.configService.get(
        'REFRESH_TOKEN_TTL_DAYS',
        DEFAULT_REFRESH_TOKEN_TTL_DAYS,
      ),
    );

    await manager.save(
      manager.create(RefreshToken, {
        userId,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + ttlDays * MS_PER_DAY),
        revokedAt: null,
      }),
    );

    return token;
  }

  async rotate(
    manager: EntityManager,
    presentedToken: string,
  ): Promise<RefreshTokenRotation> {
    const existing = await manager.findOne(RefreshToken, {
      where: { tokenHash: hashToken(presentedToken) },
    });

    if (!existing) {
      throw new UnauthorizedException(INVALID_REFRESH_TOKEN_MESSAGE);
    }

    if (existing.revokedAt) {
      const successor = await this.resolveRaceSuccessor(manager, existing);
      if (successor) {
        return this.rotateRow(manager, successor);
      }

      // Reported, not acted on: revoking here and then throwing would roll
      // the revocation back with the rest of the caller's transaction.
      return { outcome: 'reuse_detected', userId: existing.userId };
    }

    if (existing.expiresAt < new Date()) {
      throw new UnauthorizedException(INVALID_REFRESH_TOKEN_MESSAGE);
    }

    return this.rotateRow(manager, existing);
  }

  /**
   * A row that has already been rotated away is only a benign race — not
   * reuse of a stale/stolen token — when its replacement is still exactly
   * as it was left: unrevoked (nothing has rotated it onward since) and
   * unexpired, and the rotation that superseded `existing` happened
   * recently enough to plausibly be the other half of a concurrent pair of
   * requests, not a since-forgotten cookie resurfacing.
   */
  private async resolveRaceSuccessor(
    manager: EntityManager,
    existing: RefreshToken,
  ): Promise<RefreshToken | null> {
    if (!existing.replacedByTokenHash || !existing.revokedAt) {
      return null;
    }
    if (Date.now() - existing.revokedAt.getTime() > REUSE_GRACE_MS) {
      return null;
    }

    const successor = await manager.findOne(RefreshToken, {
      where: { tokenHash: existing.replacedByTokenHash },
    });
    if (!successor || successor.revokedAt || successor.expiresAt < new Date()) {
      return null;
    }

    return successor;
  }

  private async rotateRow(
    manager: EntityManager,
    row: RefreshToken,
  ): Promise<RefreshTokenRotation> {
    const token = await this.issue(manager, row.userId);
    await manager.update(RefreshToken, row.id, {
      revokedAt: new Date(),
      replacedByTokenHash: hashToken(token),
    });

    return { outcome: 'rotated', userId: row.userId, token };
  }

  async revokeAll(manager: EntityManager, userId: string): Promise<void> {
    await manager.update(
      RefreshToken,
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  /**
   * The user a refresh token belongs to, but only while it could still be
   * used: unrevoked and unexpired. Anything that acts on the whole account
   * because of a presented token must use this, or an old rotated-away
   * cookie would be enough to do it.
   */
  async findLiveOwner(
    manager: EntityManager,
    presentedToken: string,
  ): Promise<string | null> {
    const existing = await manager.findOne(RefreshToken, {
      where: { tokenHash: hashToken(presentedToken) },
    });

    if (!existing || existing.revokedAt || existing.expiresAt < new Date()) {
      return null;
    }

    return existing.userId;
  }

  /**
   * Returns the userId the revoked token belonged to (or null if it didn't
   * match anything), so callers that need to cascade the sign-out further
   * (e.g. AuthService.logout revoking device sessions too) don't have to
   * look the token up a second time.
   */
  async revokeByValue(
    manager: EntityManager,
    presentedToken: string,
  ): Promise<string | null> {
    const existing = await manager.findOne(RefreshToken, {
      where: { tokenHash: hashToken(presentedToken) },
    });

    if (!existing) {
      return null;
    }

    await manager.update(RefreshToken, existing.id, { revokedAt: new Date() });
    return existing.userId;
  }
}
