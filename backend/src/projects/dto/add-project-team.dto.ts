import { IsUUID } from 'class-validator';

export class AddProjectTeamDto {
  @IsUUID()
  teamId: string;
}
