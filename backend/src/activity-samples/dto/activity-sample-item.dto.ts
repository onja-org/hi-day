import { IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';

/** Well past anything a person can do in ten minutes, but inside `integer`. */
const MAX_COUNT = 2_000_000_000;

export class ActivitySampleItemDto {
  /** 0-100. The agent computes it as activeSegments / 60 * 100, so it is
   * already a whole percentage by the time it arrives. */
  @IsInt()
  @Min(0)
  @Max(100)
  activePercentage: number;

  @IsDateString()
  periodStart: string;

  @IsDateString()
  periodEnd: string;

  /**
   * Key presses in the period. The three counts are `null` (or absent, from
   * an agent that predates them) when the agent couldn't count — stored as
   * "not available", never 0.
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_COUNT)
  keystrokes?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_COUNT)
  mouseClicks?: number | null;

  /** Pixels of pointer travel. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_COUNT)
  mouseMovement?: number | null;
}
