import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { AuditLog } from '../database/entities/audit-log.entity';

export interface RecordAuditLogInput {
  action: string;
  organisationId?: string | null;
  actorUserId?: string | null;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditLogService {
  async record(
    manager: EntityManager,
    input: RecordAuditLogInput,
  ): Promise<void> {
    await manager.save(
      manager.create(AuditLog, {
        action: input.action,
        organisationId: input.organisationId ?? null,
        actorUserId: input.actorUserId ?? null,
        metadata: input.metadata ?? {},
      }),
    );
  }
}
