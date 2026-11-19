import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
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

  /**
   * Two-step login. Set only once the person has confirmed a code from
   * their authenticator app; null means it is off. See ADR 0038.
   */
  @Column({ type: 'timestamp', precision: 3, nullable: true })
  twoFactorEnabledAt: Date | null;

  /** The authenticator secret, encrypted by `TwoFactorSecretCipher`. */
  @Column({ type: 'text', nullable: true })
  twoFactorSecret: string | null;

  /**
   * A secret shown as a QR code but not yet confirmed with a code. Kept
   * apart from `twoFactorSecret` so starting setup again, or abandoning it,
   * never touches a secret that is already in use. Encrypted the same way.
   */
  @Column({ type: 'text', nullable: true })
  twoFactorPendingSecret: string | null;

  /** The last 30-second step a code was accepted for, so it can't be replayed. */
  @Column({ type: 'integer', nullable: true })
  twoFactorLastUsedStep: number | null;

  /**
   * Hash of the short-lived token that says "this browser got the password
   * right and still owes a code". The raw token lives only in the browser's
   * cookie, the same way refresh tokens are stored.
   */
  @Column({ type: 'varchar', nullable: true })
  @Index({ unique: true })
  twoFactorChallengeHash: string | null;

  @Column({ type: 'timestamp', precision: 3, nullable: true })
  twoFactorChallengeExpiresAt: Date | null;

  @CreateDateColumn({ precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ precision: 3 })
  updatedAt: Date;

  @OneToMany(() => Membership, (membership) => membership.user)
  memberships: Membership[];
}
