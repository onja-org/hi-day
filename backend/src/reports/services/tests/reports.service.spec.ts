import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { Membership } from '../../../database/entities/membership.entity';
import { EmailService } from '../../../email/services/email.service';
import { SendReportDto } from '../../dto/send-report.dto';
import { ReportsService } from '../reports.service';

describe('ReportsService', () => {
  const membership = {
    id: 'm1',
    user: { name: 'Ada Lovelace', email: 'ada@example.com' },
    organisation: { name: 'Acme' },
  } as unknown as Membership;

  function setup(
    options: { membership?: Membership | null; sent?: boolean } = {},
  ) {
    const findOne = jest
      .fn()
      .mockResolvedValue(
        options.membership === undefined ? membership : options.membership,
      );
    const sendReportEmail = jest.fn().mockResolvedValue(options.sent ?? true);
    const record = jest.fn().mockResolvedValue(undefined);
    const manager = {} as EntityManager;
    const transaction = jest.fn((fn: (m: EntityManager) => Promise<unknown>) =>
      fn(manager),
    );

    const service = new ReportsService(
      { findOne } as unknown as Repository<Membership>,
      { transaction } as never,
      { sendReportEmail } as unknown as EmailService,
      { record },
    );
    return { service, findOne, sendReportEmail, record };
  }

  const csvDto = (overrides: Partial<SendReportDto> = {}): SendReportDto => ({
    emails: ['a@example.com', 'b@example.com'],
    subject: 'Weekly',
    message: 'hi',
    fileType: 'csv',
    filename: 'report.csv',
    contentBase64: Buffer.from('a,b').toString('base64'),
    ...overrides,
  });

  it('emails the attachment on behalf of the sender and records the send', async () => {
    const { service, sendReportEmail, record } = setup();

    await service.send('org-1', 'user-1', csvDto());

    expect(sendReportEmail).toHaveBeenCalledWith({
      to: ['a@example.com', 'b@example.com'],
      subject: 'Weekly',
      message: 'hi',
      senderName: 'Ada Lovelace',
      senderEmail: 'ada@example.com',
      organisationName: 'Acme',
      attachment: { filename: 'report.csv', content: Buffer.from('a,b') },
    });
    expect(record).toHaveBeenCalledWith(expect.anything(), {
      action: 'report.sent',
      organisationId: 'org-1',
      actorUserId: 'user-1',
      metadata: { fileType: 'csv', recipientCount: 2 },
    });
  });

  it('looks the caller up within the organisation', async () => {
    const { service, findOne } = setup();

    await service.send('org-1', 'user-1', csvDto());

    expect(findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-1',
          organisationId: 'org-1',
        }) as object,
      }),
    );
  });

  it('refuses a caller with no active membership', async () => {
    const { service, sendReportEmail } = setup({ membership: null });

    await expect(service.send('org-1', 'user-1', csvDto())).rejects.toThrow(
      ForbiddenException,
    );
    expect(sendReportEmail).not.toHaveBeenCalled();
  });

  it('refuses a PDF attachment that is not a PDF', async () => {
    const { service, sendReportEmail } = setup();

    await expect(
      service.send(
        'org-1',
        'user-1',
        csvDto({ fileType: 'pdf', filename: 'report.pdf' }),
      ),
    ).rejects.toThrow(BadRequestException);
    expect(sendReportEmail).not.toHaveBeenCalled();
  });

  it('accepts a real PDF', async () => {
    const { service, sendReportEmail } = setup();

    await service.send(
      'org-1',
      'user-1',
      csvDto({
        fileType: 'pdf',
        filename: 'report.pdf',
        contentBase64: Buffer.from('%PDF-1.7 rest').toString('base64'),
      }),
    );

    expect(sendReportEmail).toHaveBeenCalled();
  });

  it('refuses a filename whose extension disagrees with the file type', async () => {
    const { service } = setup();

    await expect(
      service.send('org-1', 'user-1', csvDto({ filename: 'report.pdf' })),
    ).rejects.toThrow(BadRequestException);
  });

  it('fails, and records nothing, when the mail provider rejects it', async () => {
    const { service, record } = setup({ sent: false });

    await expect(service.send('org-1', 'user-1', csvDto())).rejects.toThrow(
      BadGatewayException,
    );
    expect(record).not.toHaveBeenCalled();
  });
});
