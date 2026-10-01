import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Membership } from './membership.entity';

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ type: 'varchar', nullable: true })
  name: string | null;

  @Column({ type: 'varchar', nullable: true })
  firstName: string | null;

  @Column({ type: 'varchar', nullable: true })
  lastName: string | null;

  @Column({ type: 'text', nullable: true })
  avatarUrl: string | null;

  @Column({ type: 'varchar', nullable: true })
  passwordHash: string | null;

  /**
   * The person's own IANA timezone, recorded from whichever client they last
   * signed in from rather than asked for — a setting nobody fills in is a
   * setting nobody has. Null until a client has reported one, which is why
   * the timesheet's timezone selector can say "not recorded yet" instead of
   * guessing.
   */
  @Column({ type: 'varchar', length: 64, nullable: true })
  timezone: string | null;

  @Column({ type: 'timestamp', precision: 3, nullable: true })
  emailVerifiedAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  emailVerificationToken: string | null;

  @Column({ type: 'timestamp', precision: 3, nullable: true })
  emailVerificationExpiresAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  passwordResetToken: string | null;

  @Column({ type: 'timestamp', precision: 3, nullable: true })
  passwordResetExpiresAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  pendingOrganisationName: string | null;

  @Column({ type: 'varchar', nullable: true })
  pendingOrganisationAddress: string | null;

  @Column({ type: 'varchar', nullable: true })
  pendingOrganisationWebsite: string | null;

  @CreateDateColumn({ precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ precision: 3 })
  updatedAt: Date;

  @OneToMany(() => Membership, (membership) => membership.user)
  memberships: Membership[];
}
