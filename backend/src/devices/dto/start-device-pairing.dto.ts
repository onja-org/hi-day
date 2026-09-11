import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { DevicePlatform } from '../../database/entities/device-platform.enum';

export class StartDevicePairingDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  deviceFingerprint: string;

  @IsEnum(DevicePlatform)
  platform: DevicePlatform;

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
