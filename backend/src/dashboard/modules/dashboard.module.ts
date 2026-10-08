import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthModule } from '../../auth/modules/jwt-auth.module';
import { AppEvent } from '../../database/entities/app-event.entity';
import { Membership } from '../../database/entities/membership.entity';
import { Organisation } from '../../database/entities/organisation.entity';
import { Team } from '../../database/entities/team.entity';
import { TimeEntry } from '../../database/entities/time-entry.entity';
import { TimeEntryPause } from '../../database/entities/time-entry-pause.entity';
import { UrlSession } from '../../database/entities/url-session.entity';
import { RoleGuard } from '../../common/guards/role.guard';
import { MembersModule } from '../../members/modules/members.module';
import { OrganisationsModule } from '../../organisations/modules/organisations.module';
import { ScreenshotsModule } from '../../screenshots/modules/screenshots.module';
import { DashboardController } from '../controllers/dashboard.controller';
import { DashboardService } from '../services/dashboard.service';
import { TeamDashboardService } from '../services/team-dashboard.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TimeEntry,
      TimeEntryPause,
      AppEvent,
      UrlSession,
      Membership,
      Organisation,
      Team,
    ]),
    JwtAuthModule,
    OrganisationsModule,
    MembersModule,
    ScreenshotsModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService, TeamDashboardService, RoleGuard],
})
export class DashboardModule {}
