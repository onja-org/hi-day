import { IsBoolean, ValidateIf } from 'class-validator';

export class SetTeamActivityVisibilityDto {
  /** What every plain member gets; `null` clears their override so each
   * inherits the Organisation default again. */
  @ValidateIf((_, value: boolean | null) => value !== null)
  @IsBoolean()
  canViewOwnActivity!: boolean | null;
}
