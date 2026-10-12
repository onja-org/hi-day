import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import { ASSIGNABLE_MEMBERSHIP_ROLES } from '../assignable-membership-roles';
import { APP_URL_TRACKING_VALUES } from '../../organisations/app-url-tracking';
import type { AppUrlTracking } from '../../organisations/app-url-tracking';
import { TIMESHEET_MODIFY_TIME_VALUES } from '../../organisations/timesheet-settings';
import type { TimesheetModifyTime } from '../../organisations/timesheet-settings';

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
