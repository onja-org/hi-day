import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthModule } from '../../auth/modules/jwt-auth.module';
import { RoleGuard } from '../../common/guards/role.guard';
import { Membership } from '../../database/entities/membership.entity';
import { Organisation } from '../../database/entities/organisation.entity';
import { Rollup } from '../../database/entities/rollup.entity';
import { TimeEntry } from '../../database/entities/time-entry.entity';
import { TimeEntryPause } from '../../database/entities/time-entry-pause.entity';
import { ReportsController } from '../controllers/reports.controller';
import { ReportsService } from '../services/reports.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Rollup,
      TimeEntry,
      TimeEntryPause,
      Membership,
      Organisation,
    ]),
    JwtAuthModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService, RoleGuard],
})
export class ReportsModule {}
