import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { InvitationStatus } from './invitation-status.enum';
import { MembershipRole } from './membership-role.enum';
import { Organisation } from './organisation.entity';
import { Team } from './team.entity';
import { User } from './user.entity';

@Entity({ name: 'invitations' })
export class Invitation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  email: string;

  @Column({ type: 'enum', enum: MembershipRole, enumName: 'MembershipRole' })
  role: MembershipRole;

  @Column({
    type: 'enum',
    enum: InvitationStatus,
    enumName: 'InvitationStatus',
    default: InvitationStatus.PENDING,
  })
  status: InvitationStatus;

  @Column({ unique: true })
  tokenHash: string;

  @Column({ type: 'timestamp', precision: 3, nullable: true })
  expiresAt: Date | null;

  @Column({ type: 'timestamp', precision: 3, nullable: true })
  acceptedAt: Date | null;

  @CreateDateColumn({ precision: 3 })
  createdAt: Date;

  @Column()
  organisationId: string;

  @ManyToOne(() => Organisation, (organisation) => organisation.invitations, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'organisationId' })
  organisation: Organisation;

  @Column({ type: 'uuid', nullable: true })
  teamId: string | null;

  @ManyToOne(() => Team, (team) => team.invitations, {
    nullable: true,
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'teamId' })
  team: Team | null;

  /** Projects the invitee joins (as a project member) on accepting — see
   * InvitationsService.accept. */
  @Column({ type: 'uuid', array: true, default: () => "'{}'" })
  projectIds: string[];

  @Column({ type: 'uuid', nullable: true })
  invitedByUserId: string | null;

  @ManyToOne(() => User, {
    nullable: true,
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'invitedByUserId' })
  invitedByUser: User | null;
}
