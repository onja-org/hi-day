import {
  IsBoolean,
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

  /** When the times overlap entries the save would otherwise refuse,
   * merge them all into one entry instead. See TimeEntriesService.merge. */
  @IsOptional()
  @IsBoolean()
  merge?: boolean;

  /** Kept on the `time_entry.created_manually` audit row and shown in the
   * Manual time edits report. Optional in shape; required by the service
   * whenever the organisation's `timesheetRequireReason` is on. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
