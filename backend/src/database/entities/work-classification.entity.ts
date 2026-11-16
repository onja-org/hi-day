import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Organisation } from './organisation.entity';

/** What a label is attached to: an app's name, or a website's host. */
export type WorkItemKind = 'app' | 'site';

/** Only the two real labels are stored — "unclassified" is having no row. */
export type WorkLabel = 'core' | 'non_core';

/**
 * Whether an app or website counts as core work for the whole
 * Organisation — what the Performance page's Work time classification card
 * splits time by. Matched on the name the desktop agent records (an app's
 * `appName`, a URL session's `host`), so a label applies to past time as
 * well as future: nothing is stamped onto the captured rows.
 */
@Entity({ name: 'work_classifications' })
@Check('CHK_work_classifications_kind', `"kind" IN ('app', 'site')`)
@Check('CHK_work_classifications_label', `"label" IN ('core', 'non_core')`)
@Index(
  'UQ_work_classifications_organisationId_kind_name',
  ['organisationId', 'kind', 'name'],
  {
    unique: true,
  },
)
export class WorkClassification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  organisationId: string;

  @ManyToOne(() => Organisation, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({
    name: 'organisationId',
    foreignKeyConstraintName: 'FK_work_classifications_organisationId',
  })
  organisation: Organisation;

  @Column({ type: 'varchar', length: 8 })
  kind: WorkItemKind;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 16 })
  label: WorkLabel;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
