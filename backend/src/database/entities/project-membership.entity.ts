import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Membership } from './membership.entity';
import { Project } from './project.entity';
import { ProjectMembershipRole } from './project-membership-role.enum';

/**
 * Grants an org Membership access to log time against a Project, with an
 * optional per-user rate override — see resolveProjectRate for how the
 * effective rate is picked between this and Project.rate. `role` is a
 * project-scoped permission tier, independent of the org-wide
 * MembershipRole — see ProjectMembershipRole.
 */
@Entity({ name: 'project_memberships' })
@Unique(['projectId', 'membershipId'])
export class ProjectMembership {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: ProjectMembershipRole,
    enumName: 'ProjectMembershipRole',
    default: ProjectMembershipRole.MEMBER,
  })
  role: ProjectMembershipRole;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  rate: string | null;

  @CreateDateColumn({ precision: 3 })
  createdAt: Date;

  @Column()
  projectId: string;

  @ManyToOne(() => Project, (project) => project.memberships, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'projectId' })
  project: Project;

  @Column()
  membershipId: string;

  @ManyToOne(() => Membership, (membership) => membership.projectMemberships, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'membershipId' })
  membership: Membership;
}
