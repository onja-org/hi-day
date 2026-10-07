import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { EmailService } from '../email.service';

const sendMock = jest
  .fn()
  .mockResolvedValue({ data: { id: 'email-id' }, error: null });

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: sendMock },
  })),
}));

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(async () => {
    sendMock.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) =>
              ({
                RESEND_API_KEY: 're_test_key',
                EMAIL_SENDER: 'noreply@example.com',
                FRONTEND_URL: 'http://localhost:3000',
              })[key],
          },
        },
      ],
    }).compile();

    service = module.get(EmailService);
  });

  it('sends a set-password email with a link containing the token and mentions the app and org', async () => {
    await service.sendSetPasswordEmail(
      'owner@acme.test',
      'the-token',
      'Acme Inc',
    );

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'owner@acme.test',
        subject: 'Set your password for Acme Inc',
        html: expect.stringMatching(
          /(?=.*http:\/\/localhost:3000\/set-password\?token=the-token)(?=.*Hi Day)(?=.*Acme Inc)/s,
        ) as string,
      }),
    );
  });

  it('sends a password-reset email mentioning the app and org', async () => {
    await service.sendPasswordResetEmail(
      'owner@acme.test',
      'the-token',
      'Acme Inc',
    );

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'owner@acme.test',
        subject: 'Reset your Hi Day password',
        html: expect.stringMatching(
          /(?=.*http:\/\/localhost:3000\/reset-password\?token=the-token)(?=.*Acme Inc)/s,
        ) as string,
      }),
    );
  });

  it('sends an invitation email with a join button linking to the accept-invitation page', async () => {
    await service.sendInvitationEmail(
      'invitee@acme.test',
      'the-token',
      'Acme Inc',
    );

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'invitee@acme.test',
        subject: 'Join Acme Inc on Hi Day',
        html: expect.stringMatching(
          /<a href="http:\/\/localhost:3000\/accept-invitation\?token=the-token"[^>]*>Join Acme Inc<\/a>/,
        ) as string,
      }),
    );
  });

  it('sends a duplicate-registration notice with a sign-in button, mentioning the app and org', async () => {
    await service.sendDuplicateRegistrationNotice(
      'owner@acme.test',
      'Acme Inc',
    );

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'owner@acme.test',
        subject: 'Someone tried to register with your email',
        html: expect.stringMatching(
          /(?=.*<a href="http:\/\/localhost:3000\/login")(?=.*Hi Day)(?=.*Acme Inc)/s,
        ) as string,
      }),
    );
  });

  it('logs, but does not throw, when Resend returns an error', async () => {
    sendMock.mockResolvedValueOnce({
      data: null,
      error: { name: 'invalid_api_key', message: 'Invalid API key' },
    });
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    await expect(
      service.sendSetPasswordEmail('owner@acme.test', 'the-token', 'Acme Inc'),
    ).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Invalid API key') as string,
    );
    errorSpy.mockRestore();
  });

  describe('sendReportEmail', () => {
    const report = {
      to: ['a@acme.test', 'b@acme.test'],
      subject: 'Weekly report',
      message: 'See <b>attached</b> & enjoy',
      senderName: 'Ada <script>',
      senderEmail: 'ada@acme.test',
      organisationName: 'Acme & Co',
      attachment: { filename: 'report.csv', content: Buffer.from('a,b') },
    };

    it('sends to every recipient with the attachment and replies to the sender', async () => {
      const sent = await service.sendReportEmail(report);

      expect(sent).toBe(true);
      expect(sendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'noreply@example.com',
          to: ['a@acme.test', 'b@acme.test'],
          replyTo: 'ada@acme.test',
          subject: 'Weekly report',
          attachments: [
            { filename: 'report.csv', content: Buffer.from('a,b') },
          ],
        }),
      );
    });

    it('escapes the sender-supplied text so it cannot inject markup', async () => {
      await service.sendReportEmail(report);

      const [[sent]] = sendMock.mock.calls as [[{ html: string }]];
      const { html } = sent;
      expect(html).toContain('See &lt;b&gt;attached&lt;/b&gt; &amp; enjoy');
      expect(html).toContain('Ada &lt;script&gt;');
      expect(html).toContain('Acme &amp; Co');
      expect(html).not.toContain('<script>');
    });

    it('reports a provider failure instead of swallowing it', async () => {
      sendMock.mockResolvedValueOnce({
        data: null,
        error: { message: 'boom' },
      });
      jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

      expect(await service.sendReportEmail(report)).toBe(false);
    });
  });
});
