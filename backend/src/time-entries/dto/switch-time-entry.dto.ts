import { IsOptional, IsUUID } from 'class-validator';

export class SwitchTimeEntryDto {
  /** Omit when the Organisation doesn't track time against Projects. */
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsUUID()
  taskId?: string;

  /**
   * A switch is one request that writes two rows — it ends the running
   * entry and starts the next — so recognising a replay of it takes two
   * ids, one per row. Device endpoints only; the web has no queue to
   * replay. See `TimeEntry.startOperationId`.
   */
  @IsOptional()
  @IsUUID()
  stopOpId?: string;

  @IsOptional()
  @IsUUID()
  startOpId?: string;
}
