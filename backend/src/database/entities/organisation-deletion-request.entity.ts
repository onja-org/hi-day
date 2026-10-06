import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Organisation } from './organisation.entity';
import { User } from './user.entity';

export enum OrganisationDeletionMode {
  NOW = 'now',
  SCHEDULED = 'scheduled',
  /** Skips the recovery window: confirming starts the purge — ADR-0023. */
  PERMANENT = 'permanent',
}

/**
 * An owner's pending, not-yet-emailed-confirmed request to delete their
 * Organisation. Nothing about the Organisation changes until the owner opens
 * the emailed link — only the hash of the token is stored, same as password
 * reset (see hash-token.util).
 */
@Entity({ name: 'organisation_deletion_requests' })
export class OrganisationDeletionRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index({ unique: true })
  tokenHash: string;

  @Column({
    type: 'enum',
    enum: OrganisationDeletionMode,
    enumName: 'OrganisationDeletionMode',
  })
  mode: OrganisationDeletionMode;

  @Column({ type: 'timestamp', precision: 3, nullable: true })
  scheduledFor: Date | null;

  @Column({ type: 'timestamp', precision: 3 })
  expiresAt: Date;

  @CreateDateColumn({ precision: 3 })
  createdAt: Date;

  @Column()
  organisationId: string;

  @ManyToOne(() => Organisation, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'organisationId' })
  organisation: Organisation;

  @Column()
  requestedByUserId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'requestedByUserId' })
  requestedByUser: User;
}
