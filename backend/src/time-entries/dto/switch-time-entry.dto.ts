import { IsOptional, IsUUID } from 'class-validator';

export class SwitchTimeEntryDto {
  @IsUUID()
  projectId: string;

  @IsOptional()
  @IsUUID()
  taskId?: string;
}
