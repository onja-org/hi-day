import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogModule } from '../../audit-log/modules/audit-log.module';
import { JwtAuthModule } from '../../auth/modules/jwt-auth.module';
import { RoleGuard } from '../../common/guards/role.guard';
import { Membership } from '../../database/entities/membership.entity';
import { Organisation } from '../../database/entities/organisation.entity';
import { Team } from '../../database/entities/team.entity';
import { TeamMembership } from '../../database/entities/team-membership.entity';
import { TeamsController } from '../controllers/teams.controller';
import { TeamsService } from '../services/teams.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Team, TeamMembership, Membership, Organisation]),
    AuditLogModule,
    JwtAuthModule,
  ],
  controllers: [TeamsController],
  providers: [TeamsService, RoleGuard],
  exports: [TeamsService],
})
export class TeamsModule {}
