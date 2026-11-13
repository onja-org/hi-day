import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthModule } from '../../auth/modules/jwt-auth.module';
import { RoleGuard } from '../../common/guards/role.guard';
import { Membership } from '../../database/entities/membership.entity';
import { Organisation } from '../../database/entities/organisation.entity';
import { OrganisationsModule } from '../../organisations/modules/organisations.module';
import { TimeEntriesModule } from '../../time-entries/modules/time-entries.module';
import { InsightsController } from '../controllers/insights.controller';
import { UnusualActivityController } from '../controllers/unusual-activity.controller';
import { InsightsService } from '../services/insights.service';
import { UnusualActivityService } from '../services/unusual-activity.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Membership, Organisation]),
    JwtAuthModule,
    OrganisationsModule,
    TimeEntriesModule,
  ],
  controllers: [InsightsController, UnusualActivityController],
  providers: [InsightsService, UnusualActivityService, RoleGuard],
})
export class InsightsModule {}
