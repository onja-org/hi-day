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
   * Where the browser setting this password is. Reported, not chosen —
   * same as `UpdateProfileDto.timezone` — and it becomes the new
   * Organisation's own zone, since this request is where it is created.
   *
   * Everything that asks when a day begins reads that zone: the
   * day-boundary split, the work-time limits, the dashboard's week, the
   * clock a Device is handed. Defaulting it to UTC meant every
   * organisation outside it had its days cut at the wrong hour until an
   * admin noticed a setting nobody had chosen — in Madagascar, at 3am.
   */
  @IsOptional()
  @IsString()
  @Validate(IsIanaTimezone)
  timezone?: string;
}
