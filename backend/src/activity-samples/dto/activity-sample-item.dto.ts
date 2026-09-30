import { IsDateString, IsInt, Max, Min } from 'class-validator';

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
}
