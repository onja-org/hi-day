import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { emailColumnTransformer } from '../../common/email.util';
import { Membership } from './membership.entity';

@Entity({ name: 'users' })
// Case-insensitive uniqueness on top of the plain UNIQUE constraint, so a
// writer that bypasses the column transformer (raw SQL, a script) still
// can't create a second account for `Jane@corp.com`. Expression indexes
// can't be described to TypeORM, so it's created in
// 1791180000000-NormalizeEmailCase and left alone by schema sync.
@Index('UQ_users_email_lower', { synchronize: false })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Always stored trimmed and lowercased — see `normalizeEmail`. */
  @Column({ unique: true, transformer: emailColumnTransformer })
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
   * Their own IANA timezone, recorded from whichever client they last signed
   * in from rather than asked for — a setting nobody fills in is a setting
   * nobody has. Null until one has reported, so the timesheet's selector can
   * say "not recorded yet" rather than guess.
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

  /**
   * Carried in every access token as `sv`; `JwtAuthGuard` rejects a token
   * whose `sv` no longer matches. Bumping it is the only way to end web
   * sessions whose access token hasn't expired yet ("sign out everywhere",
   * password reset). Tokens issued before this column existed carry no `sv`
   * and count as 0, so adding it signed nobody out.
   */
  @Column({ type: 'integer', default: 0 })
  sessionVersion: number;

  @CreateDateColumn({ precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ precision: 3 })
  updatedAt: Date;

  @OneToMany(() => Membership, (membership) => membership.user)
  memberships: Membership[];
}
