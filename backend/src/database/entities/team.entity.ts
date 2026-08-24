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
import { Invitation } from './invitation.entity';
import { Membership } from './membership.entity';
import { Organisation } from './organisation.entity';

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

  @OneToMany(() => Membership, (membership) => membership.team)
  memberships: Membership[];

  @OneToMany(() => Invitation, (invitation) => invitation.team)
  invitations: Invitation[];
}
