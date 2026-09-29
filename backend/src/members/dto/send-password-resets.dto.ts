import { ArrayMaxSize, ArrayMinSize, IsUUID } from 'class-validator';

const MAX_PASSWORD_RESETS_PER_REQUEST = 200;

export class SendPasswordResetsDto {
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_PASSWORD_RESETS_PER_REQUEST)
  @IsUUID('all', { each: true })
  membershipIds: string[];
}
