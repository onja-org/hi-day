import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsBoolean,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { CreateInvitationEntryDto } from './create-invitation-entry.dto';

const MAX_INVITATIONS_PER_REQUEST = 200;

export class CreateInvitationsDto {
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_INVITATIONS_PER_REQUEST)
  @ValidateNested({ each: true })
  @Type(() => CreateInvitationEntryDto)
  invitations: CreateInvitationEntryDto[];

  /**
   * The admin ticked "I understand my bill will change" for this whole
   * submission — sent only while the seats are full. An invitation that
   * carries it is charged on the spot if it fills an extra seat; one that
   * doesn't is billed on the next invoice instead (ADR 0033).
   */
  @IsOptional()
  @IsBoolean()
  seatChargeConsent?: boolean;
}
