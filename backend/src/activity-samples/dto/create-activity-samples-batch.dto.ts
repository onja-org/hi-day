import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ValidateNested } from 'class-validator';
import { ActivitySampleItemDto } from './activity-sample-item.dto';

/**
 * One sample covers ten minutes, so a batch this size is a day and a half of
 * backlog — generous room for an agent that was offline, without accepting
 * an unbounded payload.
 */
const MAX_SAMPLES_PER_BATCH = 200;

export class CreateActivitySamplesBatchDto {
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_SAMPLES_PER_BATCH)
  @ValidateNested({ each: true })
  @Type(() => ActivitySampleItemDto)
  samples: ActivitySampleItemDto[];
}
