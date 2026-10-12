import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { TIMESHEET_REASON_MAX_LENGTH } from '../timesheet-settings';

/**
 * Creating or renaming one Reason. The same shape either way — a Reason is
 * just its label — so one DTO backs both routes.
 */
export class UpsertTimesheetReasonDto {
  /** Trimmed before validation so "  " is rejected as empty, not stored. */
  @Transform(({ value }: { value: unknown }): unknown =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(TIMESHEET_REASON_MAX_LENGTH)
  label: string;
}
