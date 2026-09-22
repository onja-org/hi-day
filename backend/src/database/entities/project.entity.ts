import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Organisation } from './organisation.entity';
import { ProjectColour } from './project-colour.enum';
import { ProjectMembership } from './project-membership.entity';
import { ProjectTeam } from './project-team.entity';
import { Task } from './task.entity';

@Entity({ name: 'projects' })
@Unique(['organisationId', 'name'])
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    type: 'enum',
    enum: ProjectColour,
    enumName: 'ProjectColour',
    default: ProjectColour.BLUE,
  })
  colour: ProjectColour;

  @Column({ type: 'timestamp', precision: 3, nullable: true })
  archivedAt: Date | null;

  @CreateDateColumn({ precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ precision: 3 })
  updatedAt: Date;

  @Column()
  organisationId: string;

  @ManyToOne(() => Organisation, (organisation) => organisation.projects, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'organisationId' })
  organisation: Organisation;

  @OneToMany(() => Task, (task) => task.project)
  tasks: Task[];

  @OneToMany(
    () => ProjectMembership,
    (projectMembership) => projectMembership.project,
  )
  memberships: ProjectMembership[];

  @OneToMany(() => ProjectTeam, (projectTeam) => projectTeam.project)
  projectTeams: ProjectTeam[];
}
