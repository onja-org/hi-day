import { IsDateString, IsOptional, IsUUID, ValidateIf } from 'class-validator';

export class UpdateTimeEntryDto {
  @IsOptional()
  @IsUUID()
  projectId?: string;

  // Explicit null clears the task; omitted leaves it unchanged.
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  taskId?: string | null;

  @IsOptional()
  @IsDateString()
  startedAt?: string;

  @IsOptional()
  @IsDateString()
  endedAt?: string;
}
