import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivitySample } from '../../database/entities/activity-sample.entity';
import { Membership } from '../../database/entities/membership.entity';
import { ActivitySamplesService } from '../services/activity-samples.service';

/** No controller of its own: ingest is reached through
 * `DeviceTrackingModule`, the same way AppEvents is. */
@Module({
  imports: [TypeOrmModule.forFeature([ActivitySample, Membership])],
  providers: [ActivitySamplesService],
  exports: [ActivitySamplesService],
})
export class ActivitySamplesModule {}
