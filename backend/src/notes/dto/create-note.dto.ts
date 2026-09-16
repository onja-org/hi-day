import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateNoteDto {
  @IsDateString()
  noteDate: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content: string;
}
