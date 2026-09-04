import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class CreateManualTimeEntryDto {
  @IsOptional()
  @IsUUID()
  taskId?: string;

  @IsDateString()
  startedAt: string;

  @IsDateString()
  endedAt: string;
}
