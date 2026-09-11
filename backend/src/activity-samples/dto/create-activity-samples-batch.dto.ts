import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ValidateNested } from 'class-validator';
import { ActivitySampleItemDto } from './activity-sample-item.dto';

/** Mirrors `CreateAppEventsBatchDto`'s `MAX_EVENTS_PER_BATCH`. */
const MAX_SAMPLES_PER_BATCH = 1000;

export class CreateActivitySamplesBatchDto {
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_SAMPLES_PER_BATCH)
  @ValidateNested({ each: true })
  @Type(() => ActivitySampleItemDto)
  samples: ActivitySampleItemDto[];
}
