import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Activity } from './entities/activity.entity';
import { AuditLog } from './entities/audit-log.entity';
import { Device } from './entities/device.entity';
import { DeviceSession } from './entities/device-session.entity';
import { Invitation } from './entities/invitation.entity';
import { Membership } from './entities/membership.entity';
import { Organisation } from './entities/organisation.entity';
import { Project } from './entities/project.entity';
import { ProjectMembership } from './entities/project-membership.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { Task } from './entities/task.entity';
import { Team } from './entities/team.entity';
import { TeamMembership } from './entities/team-membership.entity';
import { TimeEntry } from './entities/time-entry.entity';
import { TimeEntryPause } from './entities/time-entry-pause.entity';
import { UrlSession } from './entities/url-session.entity';
import { User } from './entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.getOrThrow<string>('DATABASE_URL'),
        entities: [
          Organisation,
          User,
          Membership,
          Team,
          TeamMembership,
          Project,
          ProjectMembership,
          Task,
          Invitation,
          AuditLog,
          RefreshToken,
          Device,
          DeviceSession,
          TimeEntry,
          Activity,
          TimeEntry,
          TimeEntryPause,
          UrlSession,
        ],
        synchronize: false,
      }),
    }),
  ],
})
export class DatabaseModule {}
