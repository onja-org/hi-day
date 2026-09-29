import { IsEnum } from 'class-validator';
import { TaskStage } from '../../database/entities/task-stage.enum';

export class SetTaskStageDto {
  @IsEnum(TaskStage)
  stage: TaskStage;
}
