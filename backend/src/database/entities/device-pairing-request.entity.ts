import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DevicePlatform } from './device-platform.enum';
import { Organisation } from './organisation.entity';
import { User } from './user.entity';

/**
 * A short-lived request the desktop app starts (before it has any
 * credentials) to link itself to an account via the web app instead of
 * taking a password directly — see docs/adr/0009. `approvedByUserId`/
 * `approvedOrganisationId` are set once a logged-in user approves it in the
 * browser; the desktop's next poll then atomically creates the real
 * Device/DeviceSession from those fields and stamps `claimedAt`, so the
 * code is single-use. Ephemeral and non-critical — CASCADE on the user/org
 * FKs rather than RESTRICT, unlike Device's own persistent record.
 */
@Entity({ name: 'device_pairing_requests' })
export class DevicePairingRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  codeHash: string;

  @Column()
  deviceFingerprint: string;

  @Column({ type: 'enum', enum: DevicePlatform, enumName: 'DevicePlatform' })
  platform: DevicePlatform;

  @Column({ type: 'varchar', nullable: true })
  osVersion: string | null;

  @Column({ type: 'varchar', nullable: true })
  hostname: string | null;

  @Column({ type: 'varchar', nullable: true })
  appVersion: string | null;

  @CreateDateColumn({ precision: 3 })
  createdAt: Date;

  @Column({ type: 'timestamp', precision: 3 })
  expiresAt: Date;

  @Column({ type: 'uuid', nullable: true })
  approvedByUserId: string | null;

  @ManyToOne(() => User, {
    nullable: true,
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'approvedByUserId' })
  approvedByUser: User | null;

  @Column({ type: 'uuid', nullable: true })
  approvedOrganisationId: string | null;

  @ManyToOne(() => Organisation, {
    nullable: true,
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'approvedOrganisationId' })
  approvedOrganisation: Organisation | null;

  @Column({ type: 'timestamp', precision: 3, nullable: true })
  approvedAt: Date | null;

  @Column({ type: 'timestamp', precision: 3, nullable: true })
  claimedAt: Date | null;
}
