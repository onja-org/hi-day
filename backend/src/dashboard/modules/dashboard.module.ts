import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthModule } from '../../auth/modules/jwt-auth.module';
import { ActivitySample } from '../../database/entities/activity-sample.entity';
import { Membership } from '../../database/entities/membership.entity';
import { Organisation } from '../../database/entities/organisation.entity';
import { TimeEntry } from '../../database/entities/time-entry.entity';
import { TimeEntryPause } from '../../database/entities/time-entry-pause.entity';
import { RoleGuard } from '../../common/guards/role.guard';
import { DashboardController } from '../controllers/dashboard.controller';
import { DashboardService } from '../services/dashboard.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TimeEntry,
      TimeEntryPause,
      ActivitySample,
      Membership,
      Organisation,
    ]),
    JwtAuthModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService, RoleGuard],
})
export class DashboardModule {}
