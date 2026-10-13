import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class UpdateTimeEntryDto {
  @IsOptional()
  @IsUUID()
  projectId?: string;

  // Explicit null clears the task; omitted leaves it unchanged.
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  taskId?: string | null;

  @IsOptional()
  @IsDateString()
  startedAt?: string;

  @IsOptional()
  @IsDateString()
  endedAt?: string;

  /** Kept on the `time_entry.updated` audit row and shown in the Manual
   * time edits report. Optional in shape; required by the service whenever
   * the organisation's `timesheetRequireReason` is on. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
