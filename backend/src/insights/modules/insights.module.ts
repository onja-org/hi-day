import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthModule } from '../../auth/modules/jwt-auth.module';
import { RoleGuard } from '../../common/guards/role.guard';
import { Membership } from '../../database/entities/membership.entity';
import { Organisation } from '../../database/entities/organisation.entity';
import { OrganisationsModule } from '../../organisations/modules/organisations.module';
import { TimeEntriesModule } from '../../time-entries/modules/time-entries.module';
import { InsightsController } from '../controllers/insights.controller';
import { InsightsService } from '../services/insights.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Membership, Organisation]),
    JwtAuthModule,
    OrganisationsModule,
    TimeEntriesModule,
  ],
  controllers: [InsightsController],
  providers: [InsightsService, RoleGuard],
})
export class InsightsModule {}
