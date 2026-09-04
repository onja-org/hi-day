import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class AddTeamMemberDto {
  @IsUUID()
  membershipId: string;

  @IsOptional()
  @IsBoolean()
  isManager?: boolean;
}
