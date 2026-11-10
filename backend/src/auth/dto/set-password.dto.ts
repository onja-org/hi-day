import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  Validate,
} from 'class-validator';
import { IsIanaTimezone } from './is-iana-timezone.validator';
import {
  PASSWORD_COMPLEXITY_MESSAGE,
  PASSWORD_COMPLEXITY_PATTERN,
} from './password-complexity';

export class SetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @MinLength(6)
  @Matches(PASSWORD_COMPLEXITY_PATTERN, {
    message: PASSWORD_COMPLEXITY_MESSAGE,
  })
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
