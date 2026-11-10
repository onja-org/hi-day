import { IsDateString, IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class StartTimeEntryDto {
  @IsOptional()
  @IsUUID()
  taskId?: string;

  /**
   * When the person actually pressed start, for a device that was offline
   * at the time and is only now telling the server — or when idle time is
   * reassigned to another Project, back at the moment idleness began.
   * Honoured by the device endpoint only; omit for a normal start at "now".
   */
  @IsOptional()
  @IsDateString()
  startedAt?: string;

  /**
   * Idle seconds this start folds back in, set only by the agent restarting
   * after an idle prompt answered with Keep — a discarded stretch begins
   * when they came back, and a short sleep never reached the threshold.
   * Reported because only the agent knows when input stopped; the server
   * clamps it to the span it recorded. Device endpoints only.
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  idleSeconds?: number;

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
