import { IsString } from 'class-validator';

export class UpdateDisclosureDraftDto {
  @IsString()
  text: string;
}
