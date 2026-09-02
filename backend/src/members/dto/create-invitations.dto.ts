import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ValidateNested } from 'class-validator';
import { CreateInvitationEntryDto } from './create-invitation-entry.dto';

const MAX_INVITATIONS_PER_REQUEST = 200;

export class CreateInvitationsDto {
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_INVITATIONS_PER_REQUEST)
  @ValidateNested({ each: true })
  @Type(() => CreateInvitationEntryDto)
  invitations: CreateInvitationEntryDto[];
}
