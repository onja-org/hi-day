import { IsOptional, IsString, MaxLength } from 'class-validator';

export class HeartbeatDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  appVersion?: string;
}
