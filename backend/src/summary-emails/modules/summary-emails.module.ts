import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogModule } from '../../audit-log/modules/audit-log.module';
import { JwtAuthModule } from '../../auth/modules/jwt-auth.module';
import { RoleGuard } from '../../common/guards/role.guard';
import { bodyTokenTracker } from '../../common/throttler-trackers.util';
import { Membership } from '../../database/entities/membership.entity';
import { Organisation } from '../../database/entities/organisation.entity';
import { SummaryEmailSend } from '../../database/entities/summary-email-send.entity';
import { EmailModule } from '../../email/modules/email.module';
import { MembersModule } from '../../members/modules/members.module';
import { ReportsModule } from '../../reports/modules/reports.module';
import { TimeEntriesModule } from '../../time-entries/modules/time-entries.module';
import { SummaryEmailPreferencesController } from '../controllers/summary-email-preferences.controller';
import {
  GLOBAL_UNSUBSCRIBE_THROTTLE_LIMIT,
  SummaryEmailUnsubscribeController,
  UNSUBSCRIBE_THROTTLE_LIMIT,
  UNSUBSCRIBE_THROTTLE_TTL_MS,
} from '../controllers/summary-email-unsubscribe.controller';
import { SummaryEmailPreferencesService } from '../services/summary-email-preferences.service';
import { SummaryEmailsService } from '../services/summary-emails.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Membership, Organisation, SummaryEmailSend]),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: UNSUBSCRIBE_THROTTLE_TTL_MS,
        limit: GLOBAL_UNSUBSCRIBE_THROTTLE_LIMIT,
      },
      {
        name: 'unsubscribe',
        ttl: UNSUBSCRIBE_THROTTLE_TTL_MS,
        limit: UNSUBSCRIBE_THROTTLE_LIMIT,
        getTracker: bodyTokenTracker,
      },
    ]),
    AuditLogModule,
    EmailModule,
    JwtAuthModule,
    MembersModule,
    ReportsModule,
    TimeEntriesModule,
  ],
  controllers: [
    SummaryEmailPreferencesController,
    SummaryEmailUnsubscribeController,
  ],
  providers: [SummaryEmailsService, SummaryEmailPreferencesService, RoleGuard],
})
export class SummaryEmailsModule {}
