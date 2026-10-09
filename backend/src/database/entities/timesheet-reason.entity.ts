import {
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

/**
 * One selectable label in an Organisation's Reasons list — what the person
 * picks instead of typing when they add, edit or delete time.
 *
 * The chosen label is *copied* onto the audit row rather than referenced by
 * id (see docs/adr/0024-timesheet-reasons-stored-as-text.md), so nothing
 * points at these rows: renaming or deleting a Reason changes what the
 * picker offers from then on and leaves recorded history untouched.
 *
 * The unique index is case-insensitive in the database (`LOWER("label")`),
 * which TypeORM's decorator can't express — see the migration.
 */
@Entity({ name: 'timesheet_reasons' })
@Index('IDX_timesheet_reasons_organisationId', ['organisationId'])
export class TimesheetReason {
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
    foreignKeyConstraintName: 'FK_timesheet_reasons_organisationId',
  })
  organisation: Organisation;

  @Column({ type: 'varchar', length: 100 })
  label: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
