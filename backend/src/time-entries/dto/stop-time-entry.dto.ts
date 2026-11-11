import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class StopTimeEntryDto {
  /**
   * Backdates the stop to before "now" — used when discarding an idle
   * stretch (the timer is ended at when the person actually went idle,
   * not when they/the agent noticed). Omit for a normal stop.
   */
  @IsOptional()
  @IsDateString()
  endedAt?: string;

  /**
   * The entry this stop is about, for a Device replaying one it queued
   * offline. Without it the server stops whatever is running now, which
   * after a night away is a different entry. Device endpoints only.
   */
  @IsOptional()
  @IsUUID()
  entryId?: string;

  /**
   * The agent's own id for this operation, so a replay is recognised
   * rather than acted on twice — see `TimeEntry.startOperationId`. A
   * device that was offline replays queued operations on reconnect and
   * cannot tell a response it never received from one that never
   * happened. Honoured by the device endpoints only; the web has no
   * queue to replay.
   */
  @IsOptional()
  @IsUUID()
  opId?: string;
}
