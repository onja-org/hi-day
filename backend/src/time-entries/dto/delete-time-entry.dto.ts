import { IsOptional, IsString, MaxLength } from 'class-validator';

export class DeleteTimeEntryDto {
  /** Kept on the `time_entry.deleted` audit row. Optional here because
   * batch delete removes many at once with nowhere to ask per entry; the
   * single-entry dialog insists on one. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
