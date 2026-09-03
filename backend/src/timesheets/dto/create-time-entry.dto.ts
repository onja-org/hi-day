import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTimeEntryDto {
  @IsDateString()
  startedAt: string;

  @IsDateString()
  endedAt: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
