import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateManualTimeEntryDto {
  @IsOptional()
  @IsUUID()
  taskId?: string;

  @IsDateString()
  startedAt: string;

  @IsDateString()
  endedAt: string;

  /** Omit to log for yourself. Logging for someone else requires the
   * caller to be an org admin/manager, or hold a `manager`-tier
   * ProjectMembership on this Project — see
   * TimeEntriesService.resolveManualEntryTarget. */
  @IsOptional()
  @IsUUID()
  membershipId?: string;

  /** Kept on the `time_entry.created_manually` audit row and shown in the
   * Manual time edits report, matching what edit and delete already record.
   * Optional here so other callers aren't broken; whether the form insists
   * on one is the organisation's `timesheetRequireReason` setting. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
