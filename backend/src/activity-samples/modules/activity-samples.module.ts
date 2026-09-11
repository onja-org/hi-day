import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivitySample } from '../../database/entities/activity-sample.entity';
import { Membership } from '../../database/entities/membership.entity';
import { ActivitySamplesService } from '../services/activity-samples.service';

/** No controller — see docs/adr/0013-.... Exists so `DeviceTrackingModule` can use `ActivitySamplesService` for ingest. */
@Module({
  imports: [TypeOrmModule.forFeature([ActivitySample, Membership])],
  providers: [ActivitySamplesService],
  exports: [ActivitySamplesService],
})
export class ActivitySamplesModule {}
