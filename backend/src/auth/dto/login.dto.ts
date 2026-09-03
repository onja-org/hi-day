import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { DevicePlatform } from '../../database/entities/device-platform.enum';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsOptional()
  @IsString()
  captchaToken?: string;

  /**
   * Present only when this login comes from the desktop/mobile app, not the
   * web console — its presence is what triggers auto-registering (or
   * re-linking) a Device and issuing it a DeviceSession, instead of the
   * ordinary browser session cookies (see CONTEXT.md's Auto-registration
   * entry).
   */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  deviceFingerprint?: string;

  @ValidateIf((dto: LoginDto) => dto.deviceFingerprint !== undefined)
  @IsEnum(DevicePlatform)
  platform?: DevicePlatform;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  osVersion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  hostname?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  appVersion?: string;
}
