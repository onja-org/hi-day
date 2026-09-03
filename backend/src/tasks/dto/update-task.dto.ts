import {
  IsDateString,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsNumberString()
  estimate?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  // Explicit null unassigns the task; omitted leaves the assignee unchanged.
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  assigneeProjectMembershipId?: string | null;
}
