import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { MembershipRole } from './membership-role.enum';
import { MembershipStatus } from './membership-status.enum';
import { Organisation } from './organisation.entity';
import { ProjectMembership } from './project-membership.entity';
import { TeamMembership } from './team-membership.entity';
import { User } from './user.entity';

@Entity({ name: 'memberships' })
@Unique(['userId', 'organisationId'])
export class Membership {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: MembershipRole, enumName: 'MembershipRole' })
  role: MembershipRole;

  @Column({
    type: 'enum',
    enum: MembershipStatus,
    enumName: 'MembershipStatus',
    default: MembershipStatus.ACTIVE,
  })
  status: MembershipStatus;

  @Column({ type: 'timestamp', precision: 3, nullable: true })
  deactivatedAt: Date | null;

  /**
   * The jurisdiction used to resolve which DisclosureVersion applies to
   * this person (see docs/adr/0014-... and CONTEXT.md's Disclosure region
   * entry) — admin-set only, not self-reported at signup. `null` means the
   * org's region-less default disclosure text applies. Deliberately not
   * named `region` — see `Organisation.region`'s own comment for the
   * unrelated, infrastructure-level concept that word already means here.
   */
  @Column({ type: 'character varying', nullable: true })
  disclosureRegion: string | null;

  @CreateDateColumn({ precision: 3 })
  createdAt: Date;

  @Column()
  userId: string;

  @ManyToOne(() => User, (user) => user.memberships, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  organisationId: string;

  @ManyToOne(() => Organisation, (organisation) => organisation.memberships, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'organisationId' })
  organisation: Organisation;

  @OneToMany(
    () => ProjectMembership,
    (projectMembership) => projectMembership.membership,
  )
  projectMemberships: ProjectMembership[];

  @OneToMany(
    () => TeamMembership,
    (teamMembership) => teamMembership.membership,
  )
  teamMemberships: TeamMembership[];
}
