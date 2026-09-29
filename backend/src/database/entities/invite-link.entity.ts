import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { MembershipRole } from './membership-role.enum';
import { Organisation } from './organisation.entity';
import { User } from './user.entity';

/**
 * A shareable link to join an Organisation. Opening it doesn't grant
 * access by itself: the visitor enters their email and gets an ordinary
 * Invitation (carrying this link's role, teams and projects, copied at
 * that moment), so joining still proves they own the address — see
 * InviteLinksService.requestJoin. `usageCount` counts accepted joins.
 */
@Entity({ name: 'invite_links' })
export class InviteLink {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  organisationId: string;

  @ManyToOne(() => Organisation, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'organisationId' })
  organisation: Organisation;

  @Column({ length: 100 })
  name: string;

  /** Only `member` or `manager` — a link never grants admin. */
  @Column({ type: 'enum', enum: MembershipRole, enumName: 'MembershipRole' })
  role: MembershipRole;

  @Column({ type: 'uuid', array: true, default: () => "'{}'" })
  teamIds: string[];

  @Column({ type: 'uuid', array: true, default: () => "'{}'" })
  projectIds: string[];

  @Column({ type: 'timestamp', precision: 3, nullable: true })
  expiresAt: Date | null;

  /** Max accepted joins; null means unlimited. */
  @Column({ type: 'integer', nullable: true })
  usageCap: number | null;

  @Column({ type: 'integer', default: 0 })
  usageCount: number;

  @Column({ default: true })
  enabled: boolean;

  /**
   * Kept in plain text (unlike invitation tokens) so the link can be copied
   * again later. Acceptable because the token alone never grants
   * membership — the email step does.
   */
  @Column({ unique: true })
  token: string;

  @Column({ type: 'uuid', nullable: true })
  createdByUserId: string | null;

  @ManyToOne(() => User, {
    nullable: true,
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'createdByUserId' })
  createdBy: User | null;

  @CreateDateColumn({ precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ precision: 3 })
  updatedAt: Date;
}
