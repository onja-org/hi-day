import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ValidateNested } from 'class-validator';
import { AppEventItemDto } from './app-event-item.dto';

/**
 * Matches the agent's own batching cadence (docs/TECH_DESIGN.md §4:
 * "accumulate events and POST them in batches") — a generous ceiling, not a
 * tuned value; revisit if the agent's batch size or interval changes.
 */
const MAX_EVENTS_PER_BATCH = 1000;

export class CreateAppEventsBatchDto {
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_EVENTS_PER_BATCH)
  @ValidateNested({ each: true })
  @Type(() => AppEventItemDto)
  events: AppEventItemDto[];
}
