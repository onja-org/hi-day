import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuditLogModule } from '../../audit-log/modules/audit-log.module';
import { JwtAuthModule } from '../../auth/modules/jwt-auth.module';
import { RoleGuard } from '../../common/guards/role.guard';
import { Membership } from '../../database/entities/membership.entity';
import { Organisation } from '../../database/entities/organisation.entity';
import { EmailModule } from '../../email/modules/email.module';
import { ReportsController } from '../controllers/reports.controller';
import { ReportsService } from '../services/reports.service';

// Per caller and organisation rather than per IP, so one person behind a
// shared office address can't use up everyone's budget (and vice versa).
function sendReportTracker(req: Request): string {
  const organisationId = (req.params as { id?: string } | undefined)?.id ?? '';
  const userId = (req as unknown as { userId?: string }).userId ?? req.ip ?? '';
  return `${userId}:${organisationId}`;
}

@Module({
  imports: [
    TypeOrmModule.forFeature([Membership, Organisation]),
    AuditLogModule,
    EmailModule,
    JwtAuthModule,
    ThrottlerModule.forRoot([
      {
        name: 'send',
        ttl: 15 * 60 * 1000,
        limit: 10,
        getTracker: sendReportTracker,
      },
    ]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService, RoleGuard],
})
export class ReportsModule {}
