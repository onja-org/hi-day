import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { JwtAuthModule } from '../auth/jwt-auth.module';
import { RoleGuard } from '../common/guards/role.guard';
import { Membership } from '../database/entities/membership.entity';
import { Organisation } from '../database/entities/organisation.entity';
import { Team } from '../database/entities/team.entity';
import { OrganisationsController } from './organisations.controller';
import { OrganisationsService } from './organisations.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Organisation, Membership, Team]),
    AuditLogModule,
    JwtAuthModule,
  ],
  controllers: [OrganisationsController],
  providers: [OrganisationsService, RoleGuard],
  exports: [OrganisationsService],
})
export class OrganisationsModule {}
