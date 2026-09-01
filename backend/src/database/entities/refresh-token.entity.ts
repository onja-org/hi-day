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
