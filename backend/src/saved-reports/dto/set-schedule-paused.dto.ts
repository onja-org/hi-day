import { IsBoolean } from 'class-validator';

export class SetSchedulePausedDto {
  @IsBoolean()
  paused: boolean;
}
