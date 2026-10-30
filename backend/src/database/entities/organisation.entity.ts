import {
  Column,
  CreateDateColumn,
  Entity,
  Generated,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Invitation } from './invitation.entity';
import { Membership } from './membership.entity';
import { OrganisationRegion } from './organisation-region.enum';
import { Project } from './project.entity';
import { Team } from './team.entity';
import { User } from './user.entity';

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

  /**
   * Infrastructure/data-residency region — not a business or legal
   * concept, not editable by anyone, and unrelated to
   * `Membership.disclosureRegion` (a per-person jurisdiction used to pick
   * disclosure/consent text — see docs/adr/0014-... and CONTEXT.md's
   * Organisation region / Disclosure region entries). Currently a
   * placeholder single-value enum.
   */
  @Column({
    type: 'enum',
    enum: OrganisationRegion,
    enumName: 'OrganisationRegion',
    default: OrganisationRegion.US,
  })
  region: OrganisationRegion;

  @Column({ type: 'jsonb', default: {} })
  settings: Record<string, unknown>;

  /**
   * How many seats the Organisation has bought, or null where it has never
   * bought any — which is every Organisation on a trial, and how "we only
   * bill for who is actually here" is spelled.
   *
   * Deliberately **not** a cap. Members may be added past it and work
   * normally; the next invoice simply covers all of them
   * (`max(purchasedSeats, active members)` — see `BilledSeatsService`). An
   * admin buying seats ahead of a hiring round is the case this exists for,
   * and blocking the hire would be the opposite of useful.
   */
  @Column({ type: 'integer', nullable: true })
  purchasedSeats: number | null;

  /**
   * Where billing mail goes, and the address on the Stripe Customer. Null
   * means nobody has set one, and the owner's own email answers instead —
   * which is what every Organisation did before this column existed.
   *
   * Lives on the Organisation rather than the Subscription because the
   * Organisation is the thing being billed and always exists: those
   * predating trials have no `subscriptions` row at all. Any admin may
   * change it, like the rest of Billing. Billing mail goes here *and* to
   * the owner, never here alone — this address is typed by hand and never
   * verified, and a typo must not be able to swallow the one warning that
   * says access is ending.
   */
  @Column({ type: 'text', nullable: true })
  billingEmail: string | null;

  /**
   * The one admin allowed to start or cancel account deletion (see
   * CONTEXT.md's Owner entry). Set to the founding admin at creation;
   * `null` only for an org whose owner's User row has since been erased.
   */
  @Column({ type: 'uuid', nullable: true })
  ownerUserId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'ownerUserId' })
  owner: User | null;

  /**
   * Account-deletion lifecycle (see docs/adr/0021-...): `deletionScheduledFor`
   * is a future instant at which the org will be suspended; `suspendedAt`
   * means access is already cut off; `purgeAt` (always `suspendedAt` + the
   * grace window) is when the data is irreversibly erased. All `null` =
   * a normal, active org.
   */
  @Column({ type: 'timestamp', precision: 3, nullable: true })
  deletionScheduledFor: Date | null;

  @Column({ type: 'timestamp', precision: 3, nullable: true })
  suspendedAt: Date | null;

  @Column({ type: 'timestamp', precision: 3, nullable: true })
  purgeAt: Date | null;

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
