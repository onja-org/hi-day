import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_PIPE } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ActivitiesModule } from './activities/modules/activities.module';
import { AppEventsModule } from './app-events/modules/app-events.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/modules/auth.module';
import { DashboardModule } from './dashboard/modules/dashboard.module';
import { DatabaseModule } from './database/database.module';
import { DeviceTrackingModule } from './device-tracking/modules/device-tracking.module';
import { DevicesModule } from './devices/modules/devices.module';
import { MembersModule } from './members/modules/members.module';
import { ProjectsModule } from './projects/modules/projects.module';
import { ScreenshotsModule } from './screenshots/modules/screenshots.module';
import { TasksModule } from './tasks/modules/tasks.module';
import { TimeEntriesModule } from './time-entries/modules/time-entries.module';
import { TeamsModule } from './teams/modules/teams.module';
import { UrlSessionsModule } from './url-sessions/modules/url-sessions.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // Powers ScreenshotsService's @Cron retention cleanup (see
    // docs/adr/0012-...) — the only scheduled job in the app so far.
    ScheduleModule.forRoot(),
    DatabaseModule,
    AuthModule,
    MembersModule,
    DevicesModule,
    ProjectsModule,
    TasksModule,
    TimeEntriesModule,
    DeviceTrackingModule,
    ActivitiesModule,
    AppEventsModule,
    ScreenshotsModule,
    TeamsModule,
    UrlSessionsModule,
    DashboardModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    },
  ],
})
export class AppModule {}
