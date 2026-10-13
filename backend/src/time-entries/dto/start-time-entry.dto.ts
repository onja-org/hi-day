import { IsDateString, IsOptional, IsUUID } from 'class-validator';

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
}
