import { ArrayMaxSize, ArrayMinSize, IsUUID } from 'class-validator';

// Higher than password resets' 200: nothing is emailed, so "everyone" in a
// large organisation fits in one request.
const MAX_TWO_FACTOR_RESETS_PER_REQUEST = 1000;

export class ResetTwoFactorsDto {
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_TWO_FACTOR_RESETS_PER_REQUEST)
  @IsUUID('all', { each: true })
  membershipIds: string[];
}
