import { IsBoolean, IsOptional } from 'class-validator';
import { TwoFactorCodeDto } from './two-factor-code.dto';

/** The code step of logging in. */
export class TwoFactorLoginDto extends TwoFactorCodeDto {
  /** "Don't ask again on this browser": skip the code here next time. */
  @IsOptional()
  @IsBoolean()
  rememberBrowser?: boolean;
}
