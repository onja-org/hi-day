import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RequireRole } from '../../common/decorators/require-role.decorator';
import { RoleGuard } from '../../common/guards/role.guard';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import { CreateNoteDto } from '../dto/create-note.dto';
import type { NoteEntry } from '../services/notes.service';
import { NotesService } from '../services/notes.service';

@Controller('organisations/:id/notes')
@UseGuards(JwtAuthGuard, RoleGuard)
@RequireRole(
  MembershipRole.ADMIN,
  MembershipRole.MANAGER,
  MembershipRole.MEMBER,
)
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Post()
  create(
    @Body() dto: CreateNoteDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<NoteEntry> {
    return this.notesService.create(
      request.organisationId!,
      request.userId,
      dto,
    );
  }

  @Get('mine')
  listMine(
    @Query('date') date: string | undefined,
    @Req() request: AuthenticatedRequest,
  ): Promise<NoteEntry[]> {
    return this.notesService.listMineForDay(
      request.organisationId!,
      request.userId,
      date,
    );
  }

  @Delete(':noteId')
  delete(
    @Param('noteId') noteId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    return this.notesService.deleteOwn(
      request.organisationId!,
      request.userId,
      noteId,
    );
  }
}
