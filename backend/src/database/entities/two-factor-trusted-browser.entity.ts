import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

/**
 * A browser that passed two-step login and was told "don't ask again", so
 * logging in there later takes only the password (ADR 0038). The browser
 * holds the raw token in an httpOnly cookie; only its hash is stored, like
 * every other token here. Ends on its own at `expiresAt`, or for every
 * browser at once when the account's login changes (password reset,
 * signing out everywhere, two-step login turned off or reset).
 */
@Entity({ name: 'two_factor_trusted_browsers' })
export class TwoFactorTrustedBrowser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  @Index({ unique: true })
  tokenHash: string;

  @Column({ type: 'timestamp', precision: 3 })
  expiresAt: Date;

  @CreateDateColumn({ precision: 3 })
  createdAt: Date;
}
