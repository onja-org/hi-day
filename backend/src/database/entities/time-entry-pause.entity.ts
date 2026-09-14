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
import { TimeEntry } from './time-entry.entity';

/**
 * One paused span within a running `TimeEntry` — a gap ledger, not state on
 * the entry. `endedAt IS NULL` means "running" throughout this codebase, so
 * overloading it (or adding a `paused` flag) would mean re-auditing every
 * one of those call sites.
 *
 * An entry is paused exactly when it has a row here with `resumedAt IS
 * NULL`; elapsed is `(endedAt ?? now) - startedAt - sum(pause spans)`.
 */
@Entity({ name: 'time_entry_pauses' })
export class TimeEntryPause {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  organisationId: string;

  @ManyToOne(() => Organisation, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'organisationId' })
  organisation: Organisation;

  @Column()
  @Index()
  timeEntryId: string;

  @ManyToOne(() => TimeEntry, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'timeEntryId' })
  timeEntry: TimeEntry;

  @Column({ type: 'timestamptz', precision: 3 })
  pausedAt: Date;

  /** Null means this pause span is still open — the entry is paused right now. */
  @Column({ type: 'timestamptz', precision: 3, nullable: true })
  resumedAt: Date | null;

  @CreateDateColumn({ precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ precision: 3 })
  updatedAt: Date;
}
