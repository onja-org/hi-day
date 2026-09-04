import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateActivityDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content: string;
}
