import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppEventsModule } from '../../app-events/modules/app-events.module';
import { AuditLogModule } from '../../audit-log/modules/audit-log.module';
import { JwtAuthModule } from '../../auth/modules/jwt-auth.module';
import { RoleGuard } from '../../common/guards/role.guard';
import { Membership } from '../../database/entities/membership.entity';
import { Project } from '../../database/entities/project.entity';
import { Organisation } from '../../database/entities/organisation.entity';
import { SavedReport } from '../../database/entities/saved-report.entity';
import { EmailModule } from '../../email/modules/email.module';
import { UrlSessionsModule } from '../../url-sessions/modules/url-sessions.module';
import { MembersModule } from '../../members/modules/members.module';
import { TimeEntriesModule } from '../../time-entries/modules/time-entries.module';
import { SavedReportsController } from '../controllers/saved-reports.controller';
import { SavedReportsService } from '../services/saved-reports.service';
import { ScheduledReportsService } from '../services/scheduled-reports.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([SavedReport, Membership, Organisation, Project]),
    AppEventsModule,
    AuditLogModule,
    EmailModule,
    JwtAuthModule,
    MembersModule,
    TimeEntriesModule,
    UrlSessionsModule,
  ],
  controllers: [SavedReportsController],
  providers: [SavedReportsService, ScheduledReportsService, RoleGuard],
})
export class SavedReportsModule {}
