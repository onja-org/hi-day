import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Invitation } from './invitation.entity';
import { Membership } from './membership.entity';
import { Project } from './project.entity';
import { Team } from './team.entity';

@Entity({ name: 'organisations' })
export class Organisation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'jsonb', default: {} })
  settings: Record<string, unknown>;

  @CreateDateColumn({ precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ precision: 3 })
  updatedAt: Date;

  @OneToMany(() => Membership, (membership) => membership.organisation)
  memberships: Membership[];

  @OneToMany(() => Team, (team) => team.organisation)
  teams: Team[];

  @OneToMany(() => Project, (project) => project.organisation)
  projects: Project[];

  @OneToMany(() => Invitation, (invitation) => invitation.organisation)
  invitations: Invitation[];
}
