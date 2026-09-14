import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Device } from './device.entity';
import { Membership } from './membership.entity';
import { Organisation } from './organisation.entity';
import { UrlSessionConfidence } from './url-session-confidence.enum';
import { UrlSessionSource } from './url-session-source.enum';

/**
 * One closed browsing session synced from the desktop agent's local queue.
 * See docs/url-tracking-api.md for the wire contract.
 *
 * `id` is client-generated: it is the idempotency key the sync endpoint
 * upserts on, since a reopened session re-syncs the same id with a larger
 * activeMs ("last write wins", not insert-once).
 *
 * `url`/`host` are empty strings for a private session — the client strips
 * them before they leave the device, and listing code filters `url != ''`.
 */
@Entity({ name: 'url_sessions' })
export class UrlSession {
  @PrimaryColumn('uuid')
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
  membershipId: string;

  @ManyToOne(() => Membership, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'membershipId' })
  membership: Membership;

  @Column()
  deviceId: string;

  @ManyToOne(() => Device, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'deviceId' })
  device: Device;

  @Column()
  url: string;

  @Column()
  host: string;

  @Column({ type: 'varchar', nullable: true })
  path: string | null;

  @Column({ type: 'varchar', nullable: true })
  title: string | null;

  @Column()
  browser: string;

  @Column({ type: 'boolean', nullable: true })
  private: boolean | null;

  @Column({ type: 'timestamptz', precision: 3 })
  startedAt: Date;

  @Column({ type: 'timestamptz', precision: 3 })
  endedAt: Date;

  /** Accumulated active time in ms — NOT `endedAt - startedAt` (see UrlSession's client-side doc comment). */
  @Column({ type: 'integer' })
  activeMs: number;

  @Column({ type: 'integer' })
  tzOffsetMin: number;

  @Column({
    type: 'enum',
    enum: UrlSessionSource,
    enumName: 'UrlSessionSource',
  })
  source: UrlSessionSource;

  @Column({
    type: 'enum',
    enum: UrlSessionConfidence,
    enumName: 'UrlSessionConfidence',
  })
  confidence: UrlSessionConfidence;

  @CreateDateColumn({ precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ precision: 3 })
  updatedAt: Date;
}
