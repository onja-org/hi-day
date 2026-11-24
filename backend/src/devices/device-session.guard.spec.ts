import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { DeviceSession } from '../database/entities/device-session.entity';
import { Membership } from '../database/entities/membership.entity';
import { MembershipStatus } from '../database/entities/membership-status.enum';
import {
  DeviceAuthenticatedRequest,
  DeviceSessionGuard,
} from './device-session.guard';

describe('DeviceSessionGuard', () => {
  const liveSession = {
    id: 'session-1',
    deviceId: 'device-1',
    userId: 'user-1',
    organisationId: 'org-a',
    organisation: { suspendedAt: null },
  };

  function makeGuard(options: {
    session?: unknown;
    stillActiveMember?: boolean;
  }) {
    const deviceSessions = {
      findOne: jest.fn().mockResolvedValue(options.session ?? null),
    } as unknown as Repository<DeviceSession>;
    const exists = jest
      .fn()
      .mockResolvedValue(options.stillActiveMember ?? true);
    const memberships = { exists } as unknown as Repository<Membership>;
    return {
      guard: new DeviceSessionGuard(deviceSessions, memberships),
      exists,
    };
  }

  function makeContext() {
    const request = {
      headers: { authorization: 'Bearer device-token' },
    } as unknown as DeviceAuthenticatedRequest;
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    return { context, request };
  }

  it("lets a live session through and stamps who and where it's for", async () => {
    const { guard } = makeGuard({ session: liveSession });
    const { context, request } = makeContext();

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.userId).toBe('user-1');
    expect(request.organisationId).toBe('org-a');
  });

  it("checks the membership of the session's own organisation, not the device's", async () => {
    const { guard, exists } = makeGuard({ session: liveSession });
    const { context } = makeContext();

    await guard.canActivate(context);

    expect(exists).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        organisationId: 'org-a',
        status: MembershipStatus.ACTIVE,
      },
    });
  });

  it('signs out a session whose person was deactivated in its organisation', async () => {
    const { guard } = makeGuard({
      session: liveSession,
      stillActiveMember: false,
    });
    const { context } = makeContext();

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('signs out an unknown or revoked token', async () => {
    const { guard } = makeGuard({ session: null });
    const { context } = makeContext();

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
