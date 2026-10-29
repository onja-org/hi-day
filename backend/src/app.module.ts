import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_PIPE } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ActivitiesModule } from './activities/modules/activities.module';
import { AppEventsModule } from './app-events/modules/app-events.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/modules/auth.module';
import { BillingModule } from './billing/modules/billing.module';
import { ContactModule } from './contact/modules/contact.module';
import { DashboardModule } from './dashboard/modules/dashboard.module';
import { ReportsModule } from './reports/modules/reports.module';
import { SavedReportsModule } from './saved-reports/modules/saved-reports.module';
import { DatabaseModule } from './database/database.module';
import { DeviceTrackingModule } from './device-tracking/modules/device-tracking.module';
import { DevicesModule } from './devices/modules/devices.module';
import { MembersModule } from './members/modules/members.module';
import { NotesModule } from './notes/modules/notes.module';
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
    BillingModule,
    MembersModule,
    DevicesModule,
    ProjectsModule,
    TasksModule,
    TimeEntriesModule,
    DeviceTrackingModule,
    ActivitiesModule,
    AppEventsModule,
    ScreenshotsModule,
    NotesModule,
    TeamsModule,
    UrlSessionsModule,
    DashboardModule,
    ReportsModule,
    SavedReportsModule,
    ContactModule,
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
