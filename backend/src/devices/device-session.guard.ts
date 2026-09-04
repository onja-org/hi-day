import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { IsNull, Repository } from 'typeorm';
import { hashToken } from '../common/hash-token.util';
import { DeviceSession } from '../database/entities/device-session.entity';

export interface DeviceAuthenticatedRequest extends Request {
  deviceId: string;
  deviceSessionId: string;
  /**
   * From `DeviceSession.userId`/`organisationId`, not `Device`'s own
   * columns — a shared machine's `Device` row reflects whoever logged in
   * *last*, while the session tied to this specific bearer token still
   * knows who (and which org) it was actually issued to. See CONTEXT.md's
   * Device entry and `DeviceSession`'s field comments.
   */
  userId: string;
  organisationId: string;
}

const SIGNED_OUT_MESSAGE =
  "You've been signed out — please log in to continue.";

@Injectable()
export class DeviceSessionGuard implements CanActivate {
  constructor(
    @InjectRepository(DeviceSession)
    private readonly deviceSessions: Repository<DeviceSession>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<DeviceAuthenticatedRequest>();
    const token = this.readBearerToken(request);

    if (!token) {
      throw new UnauthorizedException(SIGNED_OUT_MESSAGE);
    }

    const session = await this.deviceSessions.findOne({
      where: { tokenHash: hashToken(token), revokedAt: IsNull() },
    });

    if (!session) {
      throw new UnauthorizedException(SIGNED_OUT_MESSAGE);
    }

    request.deviceId = session.deviceId;
    request.deviceSessionId = session.id;
    request.userId = session.userId;
    request.organisationId = session.organisationId;
    return true;
  }

  private readBearerToken(request: Request): string | null {
    const header = request.headers.authorization;

    if (!header?.startsWith('Bearer ')) {
      return null;
    }

    return header.slice('Bearer '.length).trim() || null;
  }
}
