import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogModule } from '../../audit-log/modules/audit-log.module';
import { JwtAuthModule } from '../../auth/modules/jwt-auth.module';
import { RoleGuard } from '../../common/guards/role.guard';
import { ConsentRecord } from '../../database/entities/consent-record.entity';
import { DisclosureVersion } from '../../database/entities/disclosure-version.entity';
import { Membership } from '../../database/entities/membership.entity';
import { Organisation } from '../../database/entities/organisation.entity';
import { OrganisationsModule } from '../../organisations/modules/organisations.module';
import { DisclosureVersionsController } from '../controllers/disclosure-versions.controller';
import { DisclosureService } from '../services/disclosure.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DisclosureVersion,
      ConsentRecord,
      Membership,
      Organisation,
    ]),
    AuditLogModule,
    OrganisationsModule,
    JwtAuthModule,
  ],
  controllers: [DisclosureVersionsController],
  providers: [DisclosureService, RoleGuard],
  exports: [DisclosureService],
})
export class DisclosureModule {}
