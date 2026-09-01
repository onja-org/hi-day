import { createHash } from 'crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EntityManager, IsNull } from 'typeorm';
import { RefreshToken } from '../../database/entities/refresh-token.entity';
import { TokenService } from './token.service';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_REFRESH_TOKEN_TTL_DAYS = 30;
const INVALID_REFRESH_TOKEN_MESSAGE = 'Session expired. Please log in again.';

export interface RotatedRefreshToken {
  userId: string;
  token: string;
}

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
        tokenHash: this.hash(token),
        expiresAt: new Date(Date.now() + ttlDays * MS_PER_DAY),
        revokedAt: null,
      }),
    );

    return token;
  }

  async rotate(
    manager: EntityManager,
    presentedToken: string,
  ): Promise<RotatedRefreshToken> {
    const existing = await manager.findOne(RefreshToken, {
      where: { tokenHash: this.hash(presentedToken) },
    });

    if (!existing) {
      throw new UnauthorizedException(INVALID_REFRESH_TOKEN_MESSAGE);
    }

    if (existing.revokedAt) {
      await this.revokeAll(manager, existing.userId);
      throw new UnauthorizedException(INVALID_REFRESH_TOKEN_MESSAGE);
    }

    if (existing.expiresAt < new Date()) {
      throw new UnauthorizedException(INVALID_REFRESH_TOKEN_MESSAGE);
    }

    await manager.update(RefreshToken, existing.id, { revokedAt: new Date() });
    const token = await this.issue(manager, existing.userId);

    return { userId: existing.userId, token };
  }

  async revokeAll(manager: EntityManager, userId: string): Promise<void> {
    await manager.update(
      RefreshToken,
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  async revokeByValue(
    manager: EntityManager,
    presentedToken: string,
  ): Promise<void> {
    await manager.update(
      RefreshToken,
      { tokenHash: this.hash(presentedToken) },
      { revokedAt: new Date() },
    );
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
