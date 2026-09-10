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
 * One closed browsing session synced up from the desktop agent's local
 * queue (`desktop/src/main/url-capture/store.ts`) — see
 * `docs/url-tracking-api.md` for the full wire contract this mirrors.
 * `id` is CLIENT-generated (not `@PrimaryGeneratedColumn`) — it is the
 * idempotency key the sync endpoint upserts on: the same id can arrive
 * more than once over its lifetime (a session that closes, syncs, then
 * reopens within the engine's merge window re-syncs the same id with a
 * larger `activeMs`/later `endedAt`), and the contract requires "last
 * write wins", not insert-once.
 *
 * `url`/`host` are empty strings (never null) for a private/incognito
 * session — `session-engine.ts` on the client strips them before this
 * ever leaves the device, and this table just persists whatever it
 * receives; querying/listing code filters on `url != ''` to keep private
 * sessions out of any user-facing display.
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
