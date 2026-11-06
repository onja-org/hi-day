import { IsOptional, IsUUID } from 'class-validator';

export class PauseTimeEntryDto {
  /**
   * The agent's own id for this pause. A pause ends the entry, so it is a
   * stop by another name and needs the same protection every other queued
   * stop has: the agent writes the record before it asks (see
   * `PendingTimerOps.pauseDurably`, which runs while the machine is
   * already shutting down), and a pause that lands with its response lost
   * would otherwise replay into a 404 and be reported to the person as
   * hours that could not be saved.
   */
  @IsOptional()
  @IsUUID()
  opId?: string;
}
