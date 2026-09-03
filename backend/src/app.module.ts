import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_PIPE } from '@nestjs/core';
import { ActivitiesModule } from './activities/modules/activities.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/modules/auth.module';
import { DatabaseModule } from './database/database.module';
import { DeviceTrackingModule } from './device-tracking/modules/device-tracking.module';
import { DevicesModule } from './devices/modules/devices.module';
import { MembersModule } from './members/modules/members.module';
import { ProjectsModule } from './projects/modules/projects.module';
import { TasksModule } from './tasks/modules/tasks.module';
import { TimeEntriesModule } from './time-entries/modules/time-entries.module';
import { TeamsModule } from './teams/modules/teams.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    AuthModule,
    MembersModule,
    DevicesModule,
    ProjectsModule,
    TasksModule,
    TimeEntriesModule,
    DeviceTrackingModule,
    ActivitiesModule,
    TimeEntriesModule,
    TeamsModule,
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
