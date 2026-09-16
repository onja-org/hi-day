import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Project } from './project.entity';
import { Team } from './team.entity';

/**
 * Grants every Membership on a Team access to a Project, as an alternative
 * to adding each Membership individually via ProjectMembership (see
 * CONTEXT.md's Project membership entry). This is access-granting only, and
 * only ever at project-MEMBER-equivalent level: it never confers Project
 * membership role MANAGER, which stays an explicit, per-Membership
 * ProjectMembership grant — see hasTeamProjectAccess's call sites.
 */
@Entity({ name: 'project_teams' })
@Unique(['projectId', 'teamId'])
export class ProjectTeam {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ precision: 3 })
  createdAt: Date;

  @Column()
  projectId: string;

  @ManyToOne(() => Project, (project) => project.projectTeams, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'projectId' })
  project: Project;

  @Column()
  teamId: string;

  @ManyToOne(() => Team, (team) => team.projectTeams, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'teamId' })
  team: Team;
}
