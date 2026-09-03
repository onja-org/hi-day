import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Membership } from './membership.entity';
import { Team } from './team.entity';

@Entity({ name: 'team_memberships' })
@Unique(['membershipId', 'teamId'])
export class TeamMembership {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  membershipId: string;

  @ManyToOne(() => Membership, (membership) => membership.teamMemberships, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'membershipId' })
  membership: Membership;

  @Column()
  teamId: string;

  @ManyToOne(() => Team, (team) => team.teamMemberships, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'teamId' })
  team: Team;

  @Column({ default: false })
  isManager: boolean;

  @CreateDateColumn({ precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ precision: 3 })
  updatedAt: Date;
}
