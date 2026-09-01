import { EntityManager } from 'typeorm';
import { AuditLog } from '../../../database/entities/audit-log.entity';
import { AuditLogService } from '../audit-log.service';

describe('AuditLogService', () => {
  function makeManager() {
    const create = jest.fn(
      (_entity: unknown, data: Record<string, unknown>) => data,
    );
    const save = jest.fn().mockResolvedValue(undefined);
    const manager = { create, save } as unknown as EntityManager;
    return { manager, create, save };
  }

  it('inserts an audit log row with the given action and metadata', async () => {
    const { manager, create, save } = makeManager();
    const service = new AuditLogService();

    await service.record(manager, {
      action: 'organisation.registered',
      organisationId: 'org-1',
      actorUserId: 'user-1',
      metadata: { source: 'signup' },
    });

    expect(create).toHaveBeenCalledWith(AuditLog, {
      action: 'organisation.registered',
      organisationId: 'org-1',
      actorUserId: 'user-1',
      metadata: { source: 'signup' },
    });
    expect(save).toHaveBeenCalledWith({
      action: 'organisation.registered',
      organisationId: 'org-1',
      actorUserId: 'user-1',
      metadata: { source: 'signup' },
    });
  });

  it('defaults organisationId, actorUserId and metadata when omitted', async () => {
    const { manager, create } = makeManager();
    const service = new AuditLogService();

    await service.record(manager, { action: 'organisation.registered' });

    expect(create).toHaveBeenCalledWith(AuditLog, {
      action: 'organisation.registered',
      organisationId: null,
      actorUserId: null,
      metadata: {},
    });
  });
});
