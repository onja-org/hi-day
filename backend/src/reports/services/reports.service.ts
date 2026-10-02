import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuditLogService } from '../../audit-log/services/audit-log.service';
import { Membership } from '../../database/entities/membership.entity';
import { MembershipStatus } from '../../database/entities/membership-status.enum';
import { EmailService } from '../../email/services/email.service';
import { SendReportDto } from '../dto/send-report.dto';

const PDF_MAGIC = '%PDF-';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Membership)
    private readonly memberships: Repository<Membership>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly emailService: EmailService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Emails a report file the caller built in the browser to the given
   * addresses. Role is enforced upstream by RoleGuard; this checks the
   * caller still has an active membership, that the attachment really is
   * what its type claims, and records who sent what to how many people —
   * addresses themselves stay out of the audit log.
   */
  async send(
    organisationId: string,
    userId: string,
    dto: SendReportDto,
  ): Promise<void> {
    const membership = await this.memberships.findOne({
      where: { userId, organisationId, status: MembershipStatus.ACTIVE },
      relations: { user: true, organisation: true },
    });
    if (!membership) {
      throw new ForbiddenException(
        'You do not have the required role for this organisation.',
      );
    }

    const content = Buffer.from(dto.contentBase64, 'base64');
    if (
      dto.fileType === 'pdf' &&
      content.subarray(0, PDF_MAGIC.length).toString('latin1') !== PDF_MAGIC
    ) {
      throw new BadRequestException('The attachment is not a valid PDF.');
    }
    if (!dto.filename.toLowerCase().endsWith(`.${dto.fileType}`)) {
      throw new BadRequestException(
        'The file name does not match the file type.',
      );
    }

    const sent = await this.emailService.sendReportEmail({
      to: dto.emails,
      subject: dto.subject,
      message: dto.message ?? '',
      senderName: membership.user.name ?? membership.user.email,
      senderEmail: membership.user.email,
      organisationName: membership.organisation.name,
      attachment: { filename: dto.filename, content },
    });
    if (!sent) {
      throw new BadGatewayException(
        'The report could not be sent. Please try again.',
      );
    }

    await this.dataSource.transaction(async (manager) => {
      await this.auditLogService.record(manager, {
        action: 'report.sent',
        organisationId,
        actorUserId: userId,
        metadata: {
          fileType: dto.fileType,
          recipientCount: dto.emails.length,
        },
      });
    });
  }
}
