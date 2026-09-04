import { IsDateString, IsOptional } from 'class-validator';

export class StopTimeEntryDto {
  /**
   * Backdates the stop to before "now" — used when discarding an idle
   * stretch (the timer is ended at when the person actually went idle,
   * not when they/the agent noticed). Omit for a normal stop.
   */
  @IsOptional()
  @IsDateString()
  endedAt?: string;
}
