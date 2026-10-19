import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogModule } from '../../audit-log/modules/audit-log.module';
import { JwtAuthModule } from '../../auth/modules/jwt-auth.module';
import { RoleGuard } from '../../common/guards/role.guard';
import { Membership } from '../../database/entities/membership.entity';
import { ProjectsEnabledGuard } from '../guards/projects-enabled.guard';
import { Organisation } from '../../database/entities/organisation.entity';
import { Project } from '../../database/entities/project.entity';
import { ProjectMembership } from '../../database/entities/project-membership.entity';
import { ProjectTeam } from '../../database/entities/project-team.entity';
import { Task } from '../../database/entities/task.entity';
import { Team } from '../../database/entities/team.entity';
import { TeamMembership } from '../../database/entities/team-membership.entity';
import { TimeEntriesModule } from '../../time-entries/modules/time-entries.module';
import { ProjectsController } from '../controllers/projects.controller';
import { ProjectRoleGuard } from '../guards/project-role.guard';
import { ProjectViewGuard } from '../guards/project-view.guard';
import { ProjectsService } from '../services/projects.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Project,
      Task,
      ProjectMembership,
      ProjectTeam,
      Team,
      TeamMembership,
      Membership,
      Organisation,
    ]),
    AuditLogModule,
    JwtAuthModule,
    TimeEntriesModule,
  ],
  controllers: [ProjectsController],
  providers: [
    ProjectsService,
    RoleGuard,
    ProjectRoleGuard,
    ProjectViewGuard,
    ProjectsEnabledGuard,
  ],
  exports: [ProjectsService],
})
export class ProjectsModule {}
