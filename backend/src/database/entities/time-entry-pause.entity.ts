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
 * `TimeEntry` itself. `TimeEntry.endedAt IS NULL` means "the timer is
 * running" everywhere in this codebase (the partial unique index, `current`,
 * `stop`, `switchTo`'s `IsNull()` lookups); overloading that same column, or
 * adding a `paused: boolean` flag, would mean re-auditing every one of those
 * call sites for a state they don't expect. Instead, a `TimeEntry` is
 * "currently paused" exactly when it has a row here with `resumedAt IS
 * NULL`, and elapsed time is `(endedAt ?? now) - startedAt - sum(pause
 * spans)` — see `TimeEntriesService`'s duration calculation.
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
