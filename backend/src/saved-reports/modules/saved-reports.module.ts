import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogModule } from '../../audit-log/modules/audit-log.module';
import { JwtAuthModule } from '../../auth/modules/jwt-auth.module';
import { RoleGuard } from '../../common/guards/role.guard';
import { Membership } from '../../database/entities/membership.entity';
import { Organisation } from '../../database/entities/organisation.entity';
import { SavedReport } from '../../database/entities/saved-report.entity';
import { EmailModule } from '../../email/modules/email.module';
import { MembersModule } from '../../members/modules/members.module';
import { TimeEntriesModule } from '../../time-entries/modules/time-entries.module';
import { SavedReportsController } from '../controllers/saved-reports.controller';
import { SavedReportsService } from '../services/saved-reports.service';
import { ScheduledReportsService } from '../services/scheduled-reports.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([SavedReport, Membership, Organisation]),
    AuditLogModule,
    EmailModule,
    JwtAuthModule,
    MembersModule,
    TimeEntriesModule,
  ],
  controllers: [SavedReportsController],
  providers: [SavedReportsService, ScheduledReportsService, RoleGuard],
})
export class SavedReportsModule {}
