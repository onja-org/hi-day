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

@Entity({ name: 'refresh_tokens' })
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index({ unique: true })
  tokenHash: string;

  @Column({ type: 'timestamp', precision: 3 })
  expiresAt: Date;

  @Column({ type: 'timestamp', precision: 3, nullable: true })
  revokedAt: Date | null;

  /**
   * The hash of the token this row was rotated into, set at the same time
   * as `revokedAt`. Lets `RefreshTokenService.rotate()` tell a benign
   * concurrent-request race (the presented token was just rotated a moment
   * ago, and its replacement hasn't been used yet) apart from genuine
   * reuse of a stale token — see the grace-window logic in `rotate()`.
   */
  @Column({ type: 'varchar', nullable: true })
  replacedByTokenHash: string | null;

  @CreateDateColumn({ precision: 3 })
  createdAt: Date;

  @Column()
  userId: string;

  @ManyToOne(() => User, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: User;
}
