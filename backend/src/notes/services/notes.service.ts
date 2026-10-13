import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuditLogService } from '../../audit-log/services/audit-log.service';
import { canViewMembership } from '../../common/membership-visibility.util';
import { Membership } from '../../database/entities/membership.entity';
import { MembershipStatus } from '../../database/entities/membership-status.enum';
import { Note } from '../../database/entities/note.entity';
import { CreateNoteDto } from '../dto/create-note.dto';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface NoteEntry {
  id: string;
  membershipId: string;
  projectId: string | null;
  noteDate: string;
  content: string;
  createdAt: Date;
}

@Injectable()
export class NotesService {
  constructor(
    @InjectRepository(Note)
    private readonly notes: Repository<Note>,
    @InjectRepository(Membership)
    private readonly memberships: Repository<Membership>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Authorization is enforced upstream by RoleGuard/@RequireRole on the
   * route — reaching this method already implies the caller is an active
   * member of this Organisation.
   */
  async create(
    organisationId: string,
    userId: string,
    dto: CreateNoteDto,
  ): Promise<NoteEntry> {
    const membership = await this.getActiveMembership(organisationId, userId);
    let note!: Note;

    await this.dataSource.transaction(async (manager) => {
      note = manager.create(Note, {
        organisationId,
        membershipId: membership.id,
        projectId: dto.projectId ?? null,
        noteDate: dto.noteDate,
        content: dto.content,
      });
      await manager.save(Note, note);

      await this.auditLogService.record(manager, {
        action: 'note.created',
        organisationId,
        actorUserId: userId,
        metadata: { noteId: note.id, noteDate: note.noteDate },
      });
    });

    return this.toEntry(note);
  }

  async listMineForDay(
    organisationId: string,
    userId: string,
    date: string | undefined,
    projectId?: string,
  ): Promise<NoteEntry[]> {
    const membership = await this.getActiveMembership(organisationId, userId);
    return this.listForMembershipId(
      organisationId,
      membership.id,
      this.resolveDate(date),
      projectId,
    );
  }

  /**
   * Visible to: the member themselves, an admin (anyone), or a manager for
   * their own team — peers never see each other's notes. Same rule as
   * Activities/AppEvents/Screenshots — see canViewMembership.
   */
  async listForMembership(
    organisationId: string,
    callerUserId: string,
    targetMembershipId: string,
    date: string | undefined,
    projectId?: string,
  ): Promise<NoteEntry[]> {
    const [caller, target] = await Promise.all([
      this.memberships.findOne({
        where: {
          userId: callerUserId,
          organisationId,
          status: MembershipStatus.ACTIVE,
        },
        relations: { teamMemberships: true },
      }),
      this.memberships.findOne({
        where: { id: targetMembershipId, organisationId },
        relations: { teamMemberships: true },
      }),
    ]);

    if (!caller || !target) {
      throw new NotFoundException('Membership not found.');
    }

    if (!canViewMembership(caller, target)) {
      throw new ForbiddenException("You cannot view this member's notes.");
    }

    return this.listForMembershipId(
      organisationId,
      target.id,
      this.resolveDate(date),
      projectId,
    );
  }

  /**
   * Author-only delete — a Note is the member's own authored text about
   * themselves, closer to a Time entry's self-editable-claim model than to
   * UrlSession's "nobody deletes their own" evidence model.
   */
  async deleteOwn(
    organisationId: string,
    userId: string,
    noteId: string,
  ): Promise<void> {
    const membership = await this.getActiveMembership(organisationId, userId);
    const note = await this.notes.findOne({
      where: { id: noteId, organisationId },
    });
    if (!note) {
      throw new NotFoundException('Note not found.');
    }
    if (note.membershipId !== membership.id) {
      throw new ForbiddenException('You can only delete your own notes.');
    }

    await this.notes.delete({ id: noteId, organisationId });

    await this.dataSource.transaction(async (manager) => {
      await this.auditLogService.record(manager, {
        action: 'note.deleted',
        organisationId,
        actorUserId: userId,
        metadata: { noteId },
      });
    });
  }

  private async listForMembershipId(
    organisationId: string,
    membershipId: string,
    date: string,
    /** undefined = every note; a string = only notes tagged with that project. */
    projectId?: string,
  ): Promise<NoteEntry[]> {
    const entries = await this.notes.find({
      where: {
        organisationId,
        membershipId,
        noteDate: date,
        ...(projectId ? { projectId } : {}),
      },
      order: { createdAt: 'DESC' },
    });
    return entries.map((entry) => this.toEntry(entry));
  }

  private resolveDate(date?: string): string {
    if (date === undefined) {
      return new Date().toISOString().slice(0, 10);
    }
    if (!DATE_PATTERN.test(date)) {
      throw new BadRequestException('date must be formatted as YYYY-MM-DD.');
    }
    return date;
  }

  private toEntry(note: Note): NoteEntry {
    return {
      id: note.id,
      membershipId: note.membershipId,
      projectId: note.projectId,
      noteDate: note.noteDate,
      content: note.content,
      createdAt: note.createdAt,
    };
  }

  private async getActiveMembership(
    organisationId: string,
    userId: string,
  ): Promise<Membership> {
    const membership = await this.memberships.findOne({
      where: { userId, organisationId, status: MembershipStatus.ACTIVE },
    });
    if (!membership) {
      throw new ForbiddenException(
        'You do not have the required role for this organisation.',
      );
    }
    return membership;
  }
}
