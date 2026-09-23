import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppEventsModule } from '../../app-events/modules/app-events.module';
import { DeviceSession } from '../../database/entities/device-session.entity';
import { Membership } from '../../database/entities/membership.entity';
import { ProjectMembership } from '../../database/entities/project-membership.entity';
import { ProjectTeam } from '../../database/entities/project-team.entity';
import { DeviceSessionGuard } from '../../devices/device-session.guard';
import { DeviceProjectMemberGuard } from '../../devices/guards/device-project-member.guard';
import { DisclosureModule } from '../../disclosure/modules/disclosure.module';
import { OrganisationsModule } from '../../organisations/modules/organisations.module';
import { ProjectsModule } from '../../projects/modules/projects.module';
import { ScreenshotsModule } from '../../screenshots/modules/screenshots.module';
import { TasksModule } from '../../tasks/modules/tasks.module';
import { TimeEntriesModule } from '../../time-entries/modules/time-entries.module';
import { UrlSessionsModule } from '../../url-sessions/modules/url-sessions.module';
import { DeviceTrackingController } from '../controllers/device-tracking.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DeviceSession,
      Membership,
      ProjectMembership,
      ProjectTeam,
    ]),
    ProjectsModule,
    TasksModule,
    TimeEntriesModule,
    OrganisationsModule,
    UrlSessionsModule,
    AppEventsModule,
    ScreenshotsModule,
    DisclosureModule,
  ],
  controllers: [DeviceTrackingController],
  providers: [DeviceSessionGuard, DeviceProjectMemberGuard],
})
export class DeviceTrackingModule {}
