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
import { Organisation } from './organisation.entity';
import { User } from './user.entity';

@Entity({ name: 'device_sessions' })
export class DeviceSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index({ unique: true })
  tokenHash: string;

  @Column({ type: 'timestamp', precision: 3, nullable: true })
  revokedAt: Date | null;

  @CreateDateColumn({ precision: 3 })
  issuedAt: Date;

  @Column()
  deviceId: string;

  @ManyToOne(() => Device, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'deviceId' })
  device: Device;

  /**
   * Who this specific session was issued to — kept even though it's usually
   * the same as `device.userId`, because a shared machine's device row can
   * be reassigned to a different user on a later login while this session
   * (now revoked as part of that reassignment) still records who it
   * actually belonged to.
   */
  @Column()
  userId: string;

  @ManyToOne(() => User, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: User;

  /**
   * Denormalized at issuance, same reasoning as `userId` above: a device's
   * own `organisationId` gets overwritten on every login (including by a
   * different org's user re-logging into the same machine), so it's not
   * safe to resolve "which org is this request for" from `Device` either.
   * This column is what device-scoped requests (see DeviceSessionGuard)
   * actually trust.
   */
  @Column()
  organisationId: string;

  @ManyToOne(() => Organisation, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'organisationId' })
  organisation: Organisation;
}
