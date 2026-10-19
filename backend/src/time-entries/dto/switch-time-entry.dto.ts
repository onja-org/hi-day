import { IsOptional, IsUUID } from 'class-validator';

export class SwitchTimeEntryDto {
  /** Omit when the Organisation doesn't track time against Projects. */
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsUUID()
  taskId?: string;
}
