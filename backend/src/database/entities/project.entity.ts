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
import { Task } from './task.entity';

@Entity({ name: 'projects' })
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ default: false })
  billable: boolean;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  rate: string | null;

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
}
