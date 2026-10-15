import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import { ASSIGNABLE_MEMBERSHIP_ROLES } from '../assignable-membership-roles';
import { ALLOWED_APPS_VALUES } from '../../organisations/allowed-apps';
import type { AllowedApps } from '../../organisations/allowed-apps';
import { APP_URL_TRACKING_VALUES } from '../../organisations/app-url-tracking';
import type { AppUrlTracking } from '../../organisations/app-url-tracking';
import { TIMESHEET_MODIFY_TIME_VALUES } from '../../organisations/timesheet-settings';
import type { TimesheetModifyTime } from '../../organisations/timesheet-settings';

/** Below this a `numeric(5,2)` column rounds to zero, which would read as
 * "may never track" — never what an admin meant to type. */
const MIN_LIMIT_HOURS = 0.01;

export class UpdateMembershipDto {
  @IsOptional()
  @IsIn(ASSIGNABLE_MEMBERSHIP_ROLES)
  role?: MembershipRole;

  @IsOptional()
  @IsBoolean()
  deactivate?: boolean;

  /**
   * The jurisdiction used to resolve which disclosure/consent text applies
   * to this person (see CONTEXT.md's Disclosure region entry). Editable by
   * an org admin (any Membership, including their own) or a manager (only
   * for a member of a team they manage — never their own Membership, same
   * as every other field here; see MembershipsService.update). `null`
   * clears it back to "use the org's region-less default text".
   */
  @IsOptional()
  @IsString()
  disclosureRegion?: string | null;

  /**
   * The person's name. Lives on their User, which is shared across every
   * organisation they belong to — so a rename here shows everywhere.
   */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName?: string;

  /**
   * Per-member override of the Organisation's Track apps & URLs default.
   * `null` clears the override so this Membership falls back to the org
   * default. Omit entirely to leave it unchanged.
   */
  @IsOptional()
  @ValidateIf((_, value: AppUrlTracking | null) => value !== null)
  @IsIn(APP_URL_TRACKING_VALUES)
  appUrlTracking?: AppUrlTracking | null;

  /** `null` clears the override and inherits the Organisation default. */
  @IsOptional()
  @ValidateIf((_, value: AllowedApps | null) => value !== null)
  @IsIn(ALLOWED_APPS_VALUES)
  allowedApps?: AllowedApps | null;

  /** Work time limit overrides; `null` clears one and inherits again. */
  @IsOptional()
  @ValidateIf((_, value: number[] | null) => value !== null)
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  expectedWorkDays?: number[] | null;

  @IsOptional()
  @ValidateIf((_, value: number[] | null) => value !== null)
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  trackingDisabledDays?: number[] | null;

  @IsOptional()
  @ValidateIf((_, value: number | null) => value !== null)
  @IsNumber()
  @Min(0)
  @Max(168)
  expectedWeeklyHours?: number | null;

  /** `null` is "no limit"; a number is a real ceiling — see `MIN_LIMIT_HOURS`. */
  @IsOptional()
  @ValidateIf((_, value: number | null) => value !== null)
  @IsNumber()
  @Min(MIN_LIMIT_HOURS)
  @Max(168)
  weeklyLimitHours?: number | null;

  @IsOptional()
  @ValidateIf((_, value: number | null) => value !== null)
  @IsNumber()
  @Min(MIN_LIMIT_HOURS)
  @Max(24)
  dailyLimitHours?: number | null;
  /** `null` inherits the Organisation's setting. */
  @IsOptional()
  @ValidateIf((_, value: boolean | null) => value !== null)
  @IsBoolean()
  canDeleteScreenshots?: boolean | null;

  /** `null` inherits; `0` is "None". Hence `@Min(0)`, where the
   * organisation's own field floors at 30 — it has no "None", that being
   * what `screenshotsEnabled` is for. */
  @IsOptional()
  @ValidateIf((_, value: number | null) => value !== null)
  @IsInt()
  @Min(0)
  screenshotFrequencySeconds?: number | null;

  /**
   * Per-member override of the Timesheets "Modify time" default. `null`
   * clears the override. Same inherit-when-null semantics as above.
   */
  @IsOptional()
  @ValidateIf((_, value: TimesheetModifyTime | null) => value !== null)
  @IsIn(TIMESHEET_MODIFY_TIME_VALUES)
  timesheetModifyTime?: TimesheetModifyTime | null;

  /**
   * Per-member override of the Timesheets "Require approval" default.
   * `null` clears the override.
   */
  @IsOptional()
  @ValidateIf((_, value: boolean | null) => value !== null)
  @IsBoolean()
  timesheetRequireApproval?: boolean | null;
}
