import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invitation } from './entities/invitation.entity';
import { Membership } from './entities/membership.entity';
import { Organisation } from './entities/organisation.entity';
import { Project } from './entities/project.entity';
import { Task } from './entities/task.entity';
import { Team } from './entities/team.entity';
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
          Project,
          Task,
          Invitation,
        ],
        synchronize: false,
      }),
    }),
  ],
})
export class DatabaseModule {}
