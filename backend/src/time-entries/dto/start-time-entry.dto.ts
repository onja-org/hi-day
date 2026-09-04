import { IsOptional, IsUUID } from 'class-validator';

export class StartTimeEntryDto {
  @IsOptional()
  @IsUUID()
  taskId?: string;
}
