import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ProjectMembershipRole } from '../../database/entities/project-membership-role.enum';

export class CreateProjectMemberDto {
  @IsUUID()
  membershipId: string;

  @IsOptional()
  @IsEnum(ProjectMembershipRole)
  role?: ProjectMembershipRole;
}
