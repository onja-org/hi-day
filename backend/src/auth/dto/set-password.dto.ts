import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  Validate,
} from 'class-validator';
import { IsIanaTimezone } from './is-iana-timezone.validator';
import {
  IsNotCommonPassword,
  PASSWORD_MIN_LENGTH,
  PASSWORD_TOO_SHORT_MESSAGE,
} from './password-policy';

export class SetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, { message: PASSWORD_TOO_SHORT_MESSAGE })
  @Validate(IsNotCommonPassword)
  password: string;

  /**
   * Where the browser setting this password is. Reported, not chosen, as
   * `UpdateProfileDto.timezone` is — and it becomes the new Organisation's
   * zone, since this request is what creates it. Everything that asks when
   * a day begins reads that: the day-boundary split, the work-time limits,
   * the dashboard's week, the clock a Device is handed.
   */
  @IsOptional()
  @IsString()
  @Validate(IsIanaTimezone)
  timezone?: string;
}
