import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { User } from '../../database/entities/user.entity';

interface AccessTokenPayload {
  sub: string;
  /** The user's `sessionVersion` when the token was signed. */
  sv?: number;
}

/**
 * Signs and checks the access-token JWT. A signature alone isn't enough: the
 * token must also carry the user's current `sessionVersion`, so bumping that
 * (`endAllSessions`) revokes every access token already handed out instead
 * of leaving them valid until they expire.
 */
@Injectable()
export class AccessTokenService {
  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  /**
   * Reads the version itself so no caller can sign a token that's already
   * stale. Call it after any transaction that bumped the version has
   * committed, or it reads the old value.
   */
  async sign(userId: string): Promise<string> {
    const user = await this.users.findOneOrFail({
      where: { id: userId },
      select: { id: true, sessionVersion: true },
    });
    const payload: AccessTokenPayload = {
      sub: userId,
      sv: user.sessionVersion,
    };
    return this.jwtService.sign(payload);
  }

  /** The token's user id, or null when it's invalid, expired or revoked. */
  async verify(token: string): Promise<string | null> {
    let payload: AccessTokenPayload;
    try {
      payload = this.jwtService.verify<AccessTokenPayload>(token);
    } catch {
      return null;
    }

    const user = await this.users.findOne({
      where: { id: payload.sub },
      select: { id: true, sessionVersion: true },
    });
    if (!user || (payload.sv ?? 0) !== user.sessionVersion) {
      return null;
    }

    return user.id;
  }

  /** Invalidates every access token issued to this user so far. */
  async endAllSessions(manager: EntityManager, userId: string): Promise<void> {
    await manager.increment(User, { id: userId }, 'sessionVersion', 1);
  }
}
