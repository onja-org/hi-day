import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogModule } from '../../audit-log/modules/audit-log.module';
import { JwtAuthModule } from '../../auth/modules/jwt-auth.module';
import { BillingModule } from '../../billing/modules/billing.module';
import { RoleGuard } from '../../common/guards/role.guard';
import { Membership } from '../../database/entities/membership.entity';
import { Organisation } from '../../database/entities/organisation.entity';
import { OrganisationDeletionRequest } from '../../database/entities/organisation-deletion-request.entity';
import { Team } from '../../database/entities/team.entity';
import { TimesheetReason } from '../../database/entities/timesheet-reason.entity';
import { User } from '../../database/entities/user.entity';
import { EmailModule } from '../../email/modules/email.module';
import { ScreenshotStorageModule } from '../../screenshots/modules/screenshot-storage.module';
import { TimeEntriesModule } from '../../time-entries/modules/time-entries.module';
import { OrganisationDeletionController } from '../controllers/organisation-deletion.controller';
import { OrganisationsController } from '../controllers/organisations.controller';
import { TimesheetReasonsController } from '../controllers/timesheet-reasons.controller';
import { OrganisationDeletionService } from '../services/organisation-deletion.service';
import { OrganisationPurgeService } from '../services/organisation-purge.service';
import { OrganisationsService } from '../services/organisations.service';
import { TimesheetReasonsService } from '../services/timesheet-reasons.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Organisation,
      Membership,
      Team,
      OrganisationDeletionRequest,
      TimesheetReason,
      User,
    ]),
    AuditLogModule,
    BillingModule,
    JwtAuthModule,
    EmailModule,
    ScreenshotStorageModule,
    TimeEntriesModule,
  ],
  controllers: [
    OrganisationsController,
    OrganisationDeletionController,
    TimesheetReasonsController,
  ],
  providers: [
    OrganisationsService,
    OrganisationDeletionService,
    OrganisationPurgeService,
    TimesheetReasonsService,
    RoleGuard,
  ],
  exports: [OrganisationsService],
})
export class OrganisationsModule {}
