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
import { Membership } from './membership.entity';
import { Organisation } from './organisation.entity';

/**
 * One 10-minute activity-level period from the desktop agent's input
 * monitoring (see docs/adr/0013-...), using Hubstaff's method: 60 ten-second
 * segments, `activePercentage = activeSegments / 60 * 100`. Attributed to
 * the Membership signed in on the Device at sample time — never derived
 * from `Device`'s own columns (see CONTEXT.md's Device entry).
 */
@Entity({ name: 'activity_samples' })
@Index(['membershipId', 'periodStart'])
export class ActivitySample {
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

  @Column({ type: 'smallint' })
  activePercentage: number;

  @Column({ type: 'timestamptz', precision: 3 })
  periodStart: Date;

  @Column({ type: 'timestamptz', precision: 3 })
  periodEnd: Date;

  @CreateDateColumn({ precision: 3 })
  createdAt: Date;
}
