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
import { Membership } from './membership.entity';
import { Organisation } from './organisation.entity';
import { DisclosureVersionStatus } from './disclosure-version-status.enum';

/**
 * The disclosure/consent text shown to a Device's user before capture
 * (window tracking, screenshots, activity sampling) is allowed to start on
 * it — see docs/adr/0014-... and CONTEXT.md's DisclosureVersion entry.
 *
 * There is exactly one mutable `draft` row per `(organisationId,
 * disclosureRegion)` at a time (enforced by a partial unique index — see
 * the migration), freely editable with no version bump and no re-consent
 * triggered. Publishing snapshots the draft's current text into a new,
 * immutable `published` row with the next `version` number for that same
 * `(organisationId, disclosureRegion)` pair — an existing published row's
 * text is never edited in place, since a ConsentRecord points at a
 * specific version and must keep meaning what it meant when recorded.
 *
 * `disclosureRegion` is deliberately not named `region` — `Organisation`
 * already has an unrelated `region` column (infrastructure/data-residency,
 * see `OrganisationRegion`). This is a per-Membership legal jurisdiction
 * used solely to pick which disclosure text applies (see CONTEXT.md's
 * Disclosure region entry).
 */
@Entity({ name: 'disclosure_versions' })
@Index(['organisationId', 'disclosureRegion', 'status'])
export class DisclosureVersion {
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

  /** `null` means the org's region-less default, matched as a fallback. */
  @Column({ type: 'character varying', nullable: true })
  disclosureRegion: string | null;

  @Column({ type: 'text' })
  text: string;

  @Column({
    type: 'enum',
    enum: DisclosureVersionStatus,
    enumName: 'DisclosureVersionStatus',
  })
  status: DisclosureVersionStatus;

  /** Only set once `status` is `published` — `null` for the draft row. */
  @Column({ type: 'int', nullable: true })
  version: number | null;

  @Column({ type: 'timestamp', precision: 3, nullable: true })
  publishedAt: Date | null;

  @Column({ nullable: true })
  publishedByMembershipId: string | null;

  @ManyToOne(() => Membership, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'publishedByMembershipId' })
  publishedByMembership: Membership | null;

  @CreateDateColumn({ precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ precision: 3 })
  updatedAt: Date;
}
