import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ProjectColour } from '../../database/entities/project-colour.enum';
import { CreateProjectMemberDto } from './create-project-member.dto';

const MAX_MEMBERS_OR_TEAMS_AT_CREATION = 200;

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsEnum(ProjectColour)
  colour?: ProjectColour;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_MEMBERS_OR_TEAMS_AT_CREATION)
  @ValidateNested({ each: true })
  @Type(() => CreateProjectMemberDto)
  members?: CreateProjectMemberDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_MEMBERS_OR_TEAMS_AT_CREATION)
  @IsUUID('4', { each: true })
  teamIds?: string[];
}
