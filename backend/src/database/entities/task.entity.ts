import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TaskStage } from './task-stage.enum';
import { Project } from './project.entity';
import { ProjectMembership } from './project-membership.entity';

@Entity({ name: 'tasks' })
export class Task {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'numeric', precision: 6, scale: 2, nullable: true })
  estimate: string | null;

  @Column({ type: 'date', nullable: true })
  dueDate: string | null;

  @Column({ type: 'timestamp', precision: 3, nullable: true })
  closedAt: Date | null;

  /** Kanban column — see TaskStage for how it tracks `closedAt`. */
  @Column({
    type: 'enum',
    enum: TaskStage,
    enumName: 'TaskStage',
    default: TaskStage.TODO,
  })
  stage: TaskStage;

  @CreateDateColumn({ precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ precision: 3 })
  updatedAt: Date;

  @Column()
  projectId: string;

  @ManyToOne(() => Project, (project) => project.tasks, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'projectId' })
  project: Project;

  @Column({ type: 'uuid', nullable: true })
  assigneeProjectMembershipId: string | null;

  @ManyToOne(() => ProjectMembership, {
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'assigneeProjectMembershipId' })
  assignee: ProjectMembership | null;
}
