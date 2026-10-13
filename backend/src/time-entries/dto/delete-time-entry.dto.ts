import { IsOptional, IsString, MaxLength } from 'class-validator';

export class DeleteTimeEntryDto {
  /** Kept on the `time_entry.deleted` audit row. Optional in shape;
   * required by the service whenever the organisation's
   * `timesheetRequireReason` is on — a batch delete sends its one reason
   * with every entry. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
