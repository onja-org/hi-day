import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AppCaptureStatus } from './app-capture-status.enum';
import { DevicePlatform } from './device-platform.enum';
import { UrlCaptureStatus } from './url-capture-status.enum';
import { Organisation } from './organisation.entity';
import { User } from './user.entity';

@Entity({ name: 'devices' })
export class Device {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Stable per-device identifier the app generates/reads on first run, so
   * re-logging in on the same machine reuses this row instead of creating a
   * duplicate. Not scoped by organisation or user — the same physical
   * machine can be re-logged-into by a different person (or a person in a
   * different org), which reassigns this row rather than forking it (see
   * CONTEXT.md's Device entry).
   */
  @Column({ unique: true })
  deviceFingerprint: string;

  @Column({ type: 'enum', enum: DevicePlatform, enumName: 'DevicePlatform' })
  platform: DevicePlatform;

  @Column({ type: 'varchar', nullable: true })
  osVersion: string | null;

  @Column({ type: 'varchar', nullable: true })
  hostname: string | null;

  @Column({ type: 'varchar', nullable: true })
  appVersion: string | null;

  @Column({ type: 'timestamp', precision: 3, nullable: true })
  lastSeenAt: Date | null;

  /**
   * Reported on the heartbeat, so a machine recording no apps reads as such
   * on the Devices page rather than as someone who used none. Null until an
   * agent new enough to report it has beaten once.
   */
  @Column({
    type: 'enum',
    enum: AppCaptureStatus,
    enumName: 'AppCaptureStatus',
    nullable: true,
  })
  appCaptureStatus: AppCaptureStatus | null;

  /** Why app capture is degraded or unavailable; null when it is ok. */
  @Column({ type: 'varchar', nullable: true })
  appCaptureDetail: string | null;

  /** The same, for reading which website is open in the browser. */
  @Column({
    type: 'enum',
    enum: UrlCaptureStatus,
    enumName: 'UrlCaptureStatus',
    nullable: true,
  })
  urlCaptureStatus: UrlCaptureStatus | null;

  /** Why URL capture is degraded or unavailable; null when it is ok. */
  @Column({ type: 'varchar', nullable: true })
  urlCaptureDetail: string | null;

  /** Linux only: session type and desktop, e.g. "x11 · ubuntu:GNOME". */
  @Column({ type: 'varchar', nullable: true })
  displaySession: string | null;

  @CreateDateColumn({ precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ precision: 3 })
  updatedAt: Date;

  @Column()
  organisationId: string;

  @ManyToOne(() => Organisation, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'organisationId' })
  organisation: Organisation;

  @Column()
  userId: string;

  @ManyToOne(() => User, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: User;
}
