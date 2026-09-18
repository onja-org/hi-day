import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogModule } from '../../audit-log/modules/audit-log.module';
import { JwtAuthModule } from '../../auth/modules/jwt-auth.module';
import { RollupsModule } from '../../rollups/modules/rollups.module';
import { Membership } from '../../database/entities/membership.entity';
import { Organisation } from '../../database/entities/organisation.entity';
import { Project } from '../../database/entities/project.entity';
import { ProjectMembership } from '../../database/entities/project-membership.entity';
import { ProjectTeam } from '../../database/entities/project-team.entity';
import { Task } from '../../database/entities/task.entity';
import { TimeEntry } from '../../database/entities/time-entry.entity';
import { TimeEntryPause } from '../../database/entities/time-entry-pause.entity';
import { ProjectMemberGuard } from '../../projects/guards/project-member.guard';
import { RoleGuard } from '../../common/guards/role.guard';
import { ProjectTimeEntriesController } from '../controllers/project-time-entries.controller';
import { TimeEntriesController } from '../controllers/time-entries.controller';
import { TimeEntriesService } from '../services/time-entries.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TimeEntry,
      TimeEntryPause,
      Membership,
      Organisation,
      Project,
      ProjectMembership,
      ProjectTeam,
      Task,
    ]),
    AuditLogModule,
    JwtAuthModule,
    RollupsModule,
  ],
  controllers: [TimeEntriesController, ProjectTimeEntriesController],
  providers: [TimeEntriesService, RoleGuard, ProjectMemberGuard],
  exports: [TimeEntriesService],
})
export class TimeEntriesModule {}
