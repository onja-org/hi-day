import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  Validate,
} from 'class-validator';
import { IsIanaTimezone } from '../../auth/dto/is-iana-timezone.validator';
import { APP_URL_TRACKING_VALUES } from '../app-url-tracking';
import type { AppUrlTracking } from '../app-url-tracking';
import { IDLE_HANDLING_VALUES } from '../idle-policy';
import type { IdleHandling } from '../idle-policy';
import { TIMESHEET_MODIFY_TIME_VALUES } from '../timesheet-settings';
import type { TimesheetModifyTime } from '../timesheet-settings';

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

  @IsOptional()
  @IsIn(APP_URL_TRACKING_VALUES)
  appUrlTracking?: AppUrlTracking;

  @IsOptional()
  @IsIn(TIMESHEET_MODIFY_TIME_VALUES)
  timesheetModifyTime?: TimesheetModifyTime;

  @IsOptional()
  @IsBoolean()
  timesheetRequireApproval?: boolean;

  @IsOptional()
  @IsBoolean()
  timesheetManagersApproveOwn?: boolean;

  @IsOptional()
  @IsBoolean()
  timesheetRequireReason?: boolean;

  @IsOptional()
  @IsBoolean()
  screenshotsEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(30)
  screenshotFrequencySeconds?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  screenshotRetentionDays?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(24)
  workingHoursPerDay?: number;

  /** The Organisation's own IANA zone — one of the three the timesheet's
   * selector offers. A settings key from the start, but fixed at 'UTC' and
   * read by nothing until now. */
  @IsOptional()
  @IsString()
  @Validate(IsIanaTimezone)
  timezone?: string;
}
