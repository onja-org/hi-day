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
  passwordHash: string | null;

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
