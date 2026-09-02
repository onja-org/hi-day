import {
  Column,
  CreateDateColumn,
  Entity,
  Generated,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Invitation } from './invitation.entity';
import { Membership } from './membership.entity';
import { OrganisationRegion } from './organisation-region.enum';
import { Project } from './project.entity';
import { Team } from './team.entity';

@Entity({ name: 'organisations' })
export class Organisation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Short, human-friendly identifier used in URLs and API responses instead
   * of the internal UUID (see docs/adr/0007-organisations-use-a-short-public-id-in-urls.md).
   * Sequence-generated starting at 100000, so it reads as a tidy 6-digit
   * number rather than starting from 1.
   */
  @Column({ type: 'integer', unique: true })
  @Generated('increment')
  publicId: number;

  @Column()
  name: string;

  @Column({ unique: true })
  slug: string;

  @Column({
    type: 'enum',
    enum: OrganisationRegion,
    enumName: 'OrganisationRegion',
    default: OrganisationRegion.US,
  })
  region: OrganisationRegion;

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
