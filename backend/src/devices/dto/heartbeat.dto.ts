import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { AppCaptureStatus } from '../../database/entities/app-capture-status.enum';
import { UrlCaptureStatus } from '../../database/entities/url-capture-status.enum';

export class HeartbeatDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  appVersion?: string;

  @IsOptional()
  @IsEnum(AppCaptureStatus)
  appCaptureStatus?: AppCaptureStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  appCaptureDetail?: string | null;

  @IsOptional()
  @IsEnum(UrlCaptureStatus)
  urlCaptureStatus?: UrlCaptureStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  urlCaptureDetail?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  displaySession?: string;
}
