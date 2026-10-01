import { IsString, MinLength } from 'class-validator';

export class ConfirmOrganisationDeletionDto {
  @IsString()
  @MinLength(1)
  token: string;
}
