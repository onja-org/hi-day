import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  Validate,
  ValidateIf,
} from 'class-validator';
import { IsIanaTimezone } from '../../auth/dto/is-iana-timezone.validator';

import { ALLOWED_APPS_VALUES } from '../allowed-apps';
import type { AllowedApps } from '../allowed-apps';
import { APP_URL_TRACKING_VALUES } from '../app-url-tracking';
import { MIN_REMINDER_INTERVAL_MINUTES } from '../tracking-reminders';
import type { TrackingReminderDelivery } from '../tracking-reminders';
import type { AppUrlTracking } from '../app-url-tracking';
import {
  INDUSTRY_VALUES,
  TAX_ID_MAX_LENGTH,
  WEEK_START_VALUES,
} from '../company-profile';
import type { Industry, WeekStart } from '../company-profile';
import { IDLE_HANDLING_VALUES } from '../idle-policy';
import type { IdleHandling } from '../idle-policy';
import { TIMESHEET_MODIFY_TIME_VALUES } from '../timesheet-settings';
import type { TimesheetModifyTime } from '../timesheet-settings';

export class UpdateOrganisationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  /** No `@MinLength`, unlike `name`: '' is how the form clears an optional
   * field, and the same goes for `industry`, `taxId` and `website`. */
  @IsOptional()
  @IsString()
  address?: string | null;

  @IsOptional()
  @IsIn([...INDUSTRY_VALUES, ''])
  industry?: Industry | '';

  @IsOptional()
  @IsString()
  @MaxLength(TAX_ID_MAX_LENGTH)
  taxId?: string | null;

  @IsOptional()
  @IsIn(WEEK_START_VALUES)
  weekStartsOn?: WeekStart;

  @IsOptional()
  @IsBoolean()
  projectsEnabled?: boolean;

  @IsOptional()
  @IsString()
  website?: string | null;

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
  @IsIn(ALLOWED_APPS_VALUES)
  allowedApps?: AllowedApps;

  @IsOptional()
  @IsBoolean()
  membersCanDeleteScreenshots?: boolean;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  expectedWorkDays?: number[];

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  trackingDisabledDays?: number[];

  /** `null` removes the target; the limits take `null` as "no limit". */
  @IsOptional()
  @ValidateIf((_, value: number | null) => value !== null)
  @IsNumber()
  @Min(0)
  @Max(168)
  expectedWeeklyHours?: number | null;

  /** `0` switches reminders off; anything else is held at or above the
   * five-minute floor, below which a reminder is just nagging. */
  @IsOptional()
  @IsInt()
  @ValidateIf((_, value: number) => value !== 0)
  @Min(MIN_REMINDER_INTERVAL_MINUTES)
  @Max(240)
  reminderIntervalMinutes?: number;

  @IsOptional()
  @IsIn(['notification', 'alert'])
  reminderDelivery?: TrackingReminderDelivery;

  /** `null` is "no limit". A number is a real ceiling, and zero would mean
   * "may never track" — never what an admin meant to type. */
  @IsOptional()
  @ValidateIf((_, value: number | null) => value !== null)
  @IsNumber()
  @Min(0.01)
  @Max(168)
  weeklyLimitHours?: number | null;

  @IsOptional()
  @ValidateIf((_, value: number | null) => value !== null)
  @IsNumber()
  @Min(0.01)
  @Max(24)
  dailyLimitHours?: number | null;

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
