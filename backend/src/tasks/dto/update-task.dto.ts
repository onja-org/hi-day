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

  // For the three optional details, explicit null clears the value;
  // omitted leaves it unchanged.
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsNumberString()
  estimate?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  dueDate?: string | null;

  // Explicit null unassigns the task; omitted leaves the assignee unchanged.
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  assigneeProjectMembershipId?: string | null;
}
