import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogModule } from '../../audit-log/modules/audit-log.module';
import { JwtAuthModule } from '../../auth/modules/jwt-auth.module';
import { Membership } from '../../database/entities/membership.entity';
import { Organisation } from '../../database/entities/organisation.entity';
import { Project } from '../../database/entities/project.entity';
import { ProjectMembership } from '../../database/entities/project-membership.entity';
import { ProjectTeam } from '../../database/entities/project-team.entity';
import { Task } from '../../database/entities/task.entity';
import { ProjectMemberGuard } from '../../projects/guards/project-member.guard';
import { ProjectRoleGuard } from '../../projects/guards/project-role.guard';
import { TasksController } from '../controllers/tasks.controller';
import { TasksService } from '../services/tasks.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Task,
      Project,
      ProjectMembership,
      ProjectTeam,
      Membership,
      Organisation,
    ]),
    AuditLogModule,
    JwtAuthModule,
  ],
  controllers: [TasksController],
  providers: [TasksService, ProjectRoleGuard, ProjectMemberGuard],
  exports: [TasksService],
})
export class TasksModule {}
