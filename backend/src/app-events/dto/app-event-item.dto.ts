import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { MAX_APP_EVENT_SAMPLE_COUNT } from '../../common/app-event-samples.util';
import { AppEventTitleUnavailableReason } from '../../database/entities/app-event-title-unavailable-reason.enum';

const TITLE_UNAVAILABLE_REASON_VALUES = Object.values(
  AppEventTitleUnavailableReason,
);

export class AppEventItemDto {
  @IsString()
  @MinLength(1)
  appName: string;

  @IsOptional()
  @IsString()
  title?: string | null;

  @IsOptional()
  @IsIn(TITLE_UNAVAILABLE_REASON_VALUES)
  titleUnavailableReason?: AppEventTitleUnavailableReason | null;

  /** When the run's first sample was taken. */
  @IsISO8601()
  sampledAt: string;

  /**
   * How many identical consecutive samples this event stands for. Optional:
   * agents from before runs existed send one event per sample and omit it,
   * which stores a run of one — exactly what they always meant.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_APP_EVENT_SAMPLE_COUNT)
  sampleCount?: number;
}
