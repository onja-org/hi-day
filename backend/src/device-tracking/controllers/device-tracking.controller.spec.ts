import { Logger, NotFoundException } from '@nestjs/common';
import { DeviceTrackingController } from './device-tracking.controller';
import type { DeviceAuthenticatedRequest } from '../../devices/device-session.guard';

const request = {
  organisationId: 'org-1',
  userId: 'user-1',
  deviceId: 'device-1',
} as DeviceAuthenticatedRequest;

function controllerWith(timeEntriesService: Record<string, jest.Mock>) {
  const none = {} as never;
  return new DeviceTrackingController(
    none,
    none,
    timeEntriesService as never,
    none,
    none,
    none,
    none,
    none,
    none,
    none,
  );
}

describe('DeviceTrackingController — refused timer actions', () => {
  let warn: jest.SpyInstance<void, [message: unknown, ...rest: unknown[]]>;
  beforeEach(() => {
    warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });
  afterEach(() => warn.mockRestore());

  it('logs a refused stop with the device, entry and operation, then refuses it as before', async () => {
    const refusal = new NotFoundException(
      'No timer is currently running on this device.',
    );
    const controller = controllerWith({
      stop: jest.fn().mockRejectedValue(refusal),
    });

    await expect(
      controller.stop(
        {
          endedAt: '2026-11-25T15:12:07.000Z',
          opId: 'op-1',
          entryId: 'entry-1',
        },
        request,
      ),
    ).rejects.toBe(refusal);

    expect(warn).toHaveBeenCalledTimes(1);
    const line = String(warn.mock.calls[0]?.[0]);
    for (const part of [
      'stop refused',
      'org=org-1',
      'device=device-1',
      'entry=entry-1',
      'op=op-1',
      'at=2026-11-25T15:12:07.000Z',
      'status=404',
      'No timer is currently running on this device.',
    ]) {
      expect(line).toContain(part);
    }
  });

  it('logs a refused start the same way', async () => {
    const controller = controllerWith({
      start: jest
        .fn()
        .mockRejectedValue(new NotFoundException('Project not found')),
    });

    await expect(
      controller.start(
        'project-1',
        { startedAt: '2026-11-25T15:00:00.000Z', opId: 'op-2' },
        request,
      ),
    ).rejects.toThrow('Project not found');

    const line = String(warn.mock.calls[0]?.[0]);
    expect(line).toContain('start refused');
    expect(line).toContain('project=project-1');
    expect(line).toContain('op=op-2');
  });

  it('logs nothing for an action that succeeds', async () => {
    const controller = controllerWith({
      stop: jest.fn().mockResolvedValue({ id: 'entry-1' }),
    });

    await controller.stop({ opId: 'op-3' }, request);

    expect(warn).not.toHaveBeenCalled();
  });

  it('logs nothing for a server fault, which is not a refusal and is logged elsewhere', async () => {
    const controller = controllerWith({
      stop: jest.fn().mockRejectedValue(new Error('db down')),
    });

    await expect(controller.stop({ opId: 'op-4' }, request)).rejects.toThrow(
      'db down',
    );

    expect(warn).not.toHaveBeenCalled();
  });
});
