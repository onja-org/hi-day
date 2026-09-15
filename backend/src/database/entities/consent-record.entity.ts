import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Device } from './device.entity';
import { DisclosureVersion } from './disclosure-version.entity';
import { Membership } from './membership.entity';
import { Organisation } from './organisation.entity';
import { ConsentDecision } from './consent-decision.enum';

/**
 * A per-Device acknowledgment that its user was shown a specific
 * DisclosureVersion and either accepted or declined — see docs/adr/0014-...
 * and CONTEXT.md's Consent record entry. Consent is per-Device, not
 * per-Membership: someone with two Devices records this separately on
 * each, since capture happens locally on that specific machine.
 *
 * Append-only, write-once from the agent (via `POST /device/consent`) —
 * nothing ever updates a row after insert, same convention as Screenshot.
 * A device's *current* consent status is always "the latest row for this
 * (deviceId, disclosureVersionId) pair", not a single mutable flag — a
 * person can decline, be shown the screen again later, and grant it, and
 * both attempts stay on the record.
 */
@Entity({ name: 'consent_records' })
@Index(['deviceId', 'disclosureVersionId', 'createdAt'])
export class ConsentRecord {
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
  disclosureVersionId: string;

  @ManyToOne(() => DisclosureVersion, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'disclosureVersionId' })
  disclosureVersion: DisclosureVersion;

  @Column({ type: 'enum', enum: ConsentDecision, enumName: 'ConsentDecision' })
  decision: ConsentDecision;

  @CreateDateColumn({ precision: 3 })
  createdAt: Date;
}
