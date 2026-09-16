import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Membership } from './membership.entity';
import { Organisation } from './organisation.entity';
import { Project } from './project.entity';

/**
 * A member's own note for one calendar day, optionally tagged with a
 * project — distinct from `Activity` (a generic, day-agnostic freeform post
 * feed with its own unrelated consumer, see MemberActivityList). Not linked
 * to a specific `TimeEntry.id`: the midnight auto-split cron
 * (TimeEntriesService.splitRunningEntriesAcrossDayBoundary) recreates
 * TimeEntry rows nightly, which would silently orphan a TimeEntry-scoped
 * note. A calendar day is stable; a TimeEntry.id isn't.
 */
@Entity({ name: 'notes' })
@Index(['organisationId', 'membershipId', 'noteDate'])
export class Note {
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

  /** Author == subject — no manager-authored notes about someone else. */
  @Column()
  membershipId: string;

  @ManyToOne(() => Membership, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'membershipId' })
  membership: Membership;

  /**
   * `SET NULL`, deliberately diverging from this schema's usual `RESTRICT`
   * — a note is a personal record, and a deleted project shouldn't become
   * un-deletable just because someone once wrote a note against it.
   */
  @Column({ type: 'uuid', nullable: true })
  projectId: string | null;

  @ManyToOne(() => Project, {
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'projectId' })
  project: Project | null;

  /** The calendar day this note is about — `date`, not `timestamptz`. */
  @Column({ type: 'date' })
  noteDate: string;

  @Column({ type: 'text' })
  content: string;

  @CreateDateColumn({ precision: 3 })
  createdAt: Date;
}
