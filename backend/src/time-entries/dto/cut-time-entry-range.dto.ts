import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export const CUT_MODES = ['remove', 'split'] as const;
export type CutMode = (typeof CUT_MODES)[number];

/**
 * A range typed inside one stopped entry. `remove` drops it and keeps the
 * time either side as separate entries; `split` keeps all three pieces
 * (before, the range, after) so the middle one can be moved elsewhere.
 */
export class CutTimeEntryRangeDto {
  @IsDateString()
  from: string;

  @IsDateString()
  to: string;

  @IsIn(CUT_MODES)
  mode: CutMode;

  /** Required by the service when removing and the organisation's
   * `timesheetRequireReason` is on, like any other change to recorded time. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
