import { IsEnum, IsOptional } from 'class-validator';
import { ProjectMembershipRole } from '../../database/entities/project-membership-role.enum';

export class UpdateProjectMemberDto {
  @IsOptional()
  @IsEnum(ProjectMembershipRole)
  role?: ProjectMembershipRole;
}
