import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogModule } from '../../audit-log/modules/audit-log.module';
import { JwtAuthModule } from '../../auth/modules/jwt-auth.module';
import { RoleGuard } from '../../common/guards/role.guard';
import { Membership } from '../../database/entities/membership.entity';
import { Organisation } from '../../database/entities/organisation.entity';
import { Project } from '../../database/entities/project.entity';
import { ProjectMembership } from '../../database/entities/project-membership.entity';
import { Task } from '../../database/entities/task.entity';
import { ProjectsController } from '../controllers/projects.controller';
import { ProjectRoleGuard } from '../guards/project-role.guard';
import { ProjectsService } from '../services/projects.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Project,
      Task,
      ProjectMembership,
      Membership,
      Organisation,
    ]),
    AuditLogModule,
    JwtAuthModule,
  ],
  controllers: [ProjectsController],
  providers: [ProjectsService, RoleGuard, ProjectRoleGuard],
  exports: [ProjectsService],
})
export class ProjectsModule {}
