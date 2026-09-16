import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogModule } from '../../audit-log/modules/audit-log.module';
import { JwtAuthModule } from '../../auth/modules/jwt-auth.module';
import { RoleGuard } from '../../common/guards/role.guard';
import { Membership } from '../../database/entities/membership.entity';
import { Note } from '../../database/entities/note.entity';
import { Organisation } from '../../database/entities/organisation.entity';
import { Project } from '../../database/entities/project.entity';
import { NotesController } from '../controllers/notes.controller';
import { NotesService } from '../services/notes.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Note, Membership, Organisation, Project]),
    AuditLogModule,
    JwtAuthModule,
  ],
  controllers: [NotesController],
  providers: [NotesService, RoleGuard],
  exports: [NotesService],
})
export class NotesModule {}
