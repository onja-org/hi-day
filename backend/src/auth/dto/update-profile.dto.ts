import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

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

  // Empty string clears the avatar; otherwise expected to be a data: URI.
  @IsOptional()
  @IsString()
  @MaxLength(MAX_AVATAR_LENGTH)
  avatarUrl?: string;
}
