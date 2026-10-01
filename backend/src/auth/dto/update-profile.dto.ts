import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Validate,
} from 'class-validator';
import { IsIanaTimezone } from './is-iana-timezone.validator';

const MAX_AVATAR_LENGTH = 2 * 1024 * 1024;

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  lastName?: string;

  /** Reported by the client, not chosen — see `User.timezone`. Validated
   * because it arrives from a browser. */
  @IsOptional()
  @IsString()
  @Validate(IsIanaTimezone)
  timezone?: string;

  // Empty string clears the avatar; otherwise expected to be a data: URI.
  @IsOptional()
  @IsString()
  @MaxLength(MAX_AVATAR_LENGTH)
  avatarUrl?: string;
}
