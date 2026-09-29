import { IsDateString } from 'class-validator';

export class SplitTimeEntryDto {
  /** The instant to cut the entry at. Must fall strictly inside its span —
   * splitting at either boundary would leave one half empty. */
  @IsDateString()
  at: string;
}
