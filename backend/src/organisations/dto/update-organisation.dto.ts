import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { IDLE_HANDLING_VALUES } from '../idle-policy';
import type { IdleHandling } from '../idle-policy';

export class UpdateOrganisationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  address?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsIn(IDLE_HANDLING_VALUES)
  idleHandling?: IdleHandling;

  @IsOptional()
  @IsInt()
  @Min(1)
  idleThresholdMinutes?: number;

  @IsOptional()
  @IsBoolean()
  windowTrackingEnabled?: boolean;
}
