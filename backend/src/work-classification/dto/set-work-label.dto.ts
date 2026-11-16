import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import type { WorkItemKind } from '../../database/entities/work-classification.entity';

export const WORK_ITEM_KINDS: readonly WorkItemKind[] = ['app', 'site'];

/** What an admin can pick for an app or site; "unclassified" removes the label. */
export type WorkLabelChoice = 'core' | 'non_core' | 'unclassified';

export const WORK_LABEL_CHOICES: readonly WorkLabelChoice[] = [
  'core',
  'non_core',
  'unclassified',
];

/** Labels one app (by its recorded name) or website (by its host). */
export class SetWorkLabelDto {
  @IsIn(WORK_ITEM_KINDS)
  kind: WorkItemKind;

  @Transform(({ value }: { value: unknown }): unknown =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsIn(WORK_LABEL_CHOICES)
  label: WorkLabelChoice;
}
