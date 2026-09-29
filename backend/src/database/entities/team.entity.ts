import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Organisation } from './organisation.entity';
import { ProjectTeam } from './project-team.entity';
import { TeamMembership } from './team-membership.entity';

@Entity({ name: 'teams' })
export class Team {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @CreateDateColumn({ precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ precision: 3 })
  updatedAt: Date;

  @Column()
  organisationId: string;

  @ManyToOne(() => Organisation, (organisation) => organisation.teams, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'organisationId' })
  organisation: Organisation;

  @OneToMany(() => TeamMembership, (teamMembership) => teamMembership.team)
  teamMemberships: TeamMembership[];

  @OneToMany(() => ProjectTeam, (projectTeam) => projectTeam.team)
  projectTeams: ProjectTeam[];
}
