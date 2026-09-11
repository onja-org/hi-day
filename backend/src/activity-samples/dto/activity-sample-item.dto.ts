import { IsISO8601, IsInt, Max, Min } from 'class-validator';

export class ActivitySampleItemDto {
  @IsInt()
  @Min(0)
  @Max(100)
  activePercentage: number;

  @IsISO8601()
  periodStart: string;

  @IsISO8601()
  periodEnd: string;
}
