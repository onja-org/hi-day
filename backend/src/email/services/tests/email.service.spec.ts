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

const smtpSendMail = jest.fn().mockResolvedValue({});
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: smtpSendMail })),
}));

/**
 * `RESEND_API_KEY` is read with `get`, not `getOrThrow`: it is optional, so
 * an absent one must answer undefined rather than throw. Both are stubbed
 * because `FRONTEND_URL` is still required.
 */
function configWith(values: Record<string, string | undefined>) {
  return {
    get: (key: string) => values[key],
    getOrThrow: (key: string) => values[key],
  };
}

const CONFIGURED = {
  RESEND_API_KEY: 're_test_key',
  EMAIL_SENDER: 'noreply@example.com',
  FRONTEND_URL: 'http://localhost:3000',
};

async function serviceWith(
  values: Record<string, string | undefined>,
): Promise<EmailService> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      EmailService,
      { provide: ConfigService, useValue: configWith(values) },
    ],
  }).compile();
  return module.get(EmailService);
}

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(async () => {
    sendMock.mockClear();
    smtpSendMail.mockClear();
    service = await serviceWith(CONFIGURED);
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

/**
 * Email is optional, because requiring an account with a third-party
 * provider before the app will start would make "free to self-host"
 * untrue. The Resend SDK throws on an empty key — and an empty key is
 * exactly what copying .env.example gives you — so this is the difference
 * between a self-hosted install booting and not.
 */
/** Everything the logger was handed, as one searchable string. */
function loggedLines(warn: jest.SpyInstance): string {
  return (warn.mock.calls as unknown[][])
    .map((call) => String(call[0]))
    .join('\n');
}

describe('EmailService with no provider configured', () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    sendMock.mockClear();
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  });

  afterEach(() => warn.mockRestore());

  for (const [label, key] of [
    ['unset', undefined],
    ['empty', ''],
    ['whitespace', '   '],
  ] as const) {
    it(`starts with a ${label} key`, async () => {
      await expect(
        serviceWith({ ...CONFIGURED, RESEND_API_KEY: key }),
      ).resolves.toBeDefined();
    });
  }

  it('knows it is not delivering', async () => {
    const offline = await serviceWith({
      ...CONFIGURED,
      RESEND_API_KEY: undefined,
    });

    expect(offline.isDelivering).toBe(false);
  });

  it('is delivering once a key is set', async () => {
    const online = await serviceWith(CONFIGURED);

    expect(online.isDelivering).toBe(true);
  });

  it('sends nothing to the provider', async () => {
    const offline = await serviceWith({
      ...CONFIGURED,
      RESEND_API_KEY: undefined,
    });

    await offline.sendSetPasswordEmail('owner@acme.test', 'tok', 'Acme');

    expect(sendMock).not.toHaveBeenCalled();
  });

  /**
   * The links are the point. Setting a first password, accepting an
   * invitation and confirming a deletion are each only completable through
   * a one-time URL. Without this, an operator could create an organisation
   * and never be able to sign in to it.
   */
  it('logs the link so the flow can still be completed', async () => {
    const offline = await serviceWith({
      ...CONFIGURED,
      RESEND_API_KEY: undefined,
    });

    await offline.sendSetPasswordEmail('owner@acme.test', 'the-token', 'Acme');

    const logged = loggedLines(warn);
    expect(logged).toContain(
      'http://localhost:3000/set-password?token=the-token',
    );
    expect(logged).toContain('owner@acme.test');
  });

  it('logs invitation links too', async () => {
    const offline = await serviceWith({
      ...CONFIGURED,
      RESEND_API_KEY: undefined,
    });

    await offline.sendInvitationEmail('new@acme.test', 'invite-token', 'Acme');

    const logged = loggedLines(warn);
    expect(logged).toContain('invite-token');
  });

  /**
   * Callers treat a failure as worth logging but never as a reason to fail
   * the request behind it. A message that was logged rather than sent is
   * not a failure from the caller's point of view, so it must not read as
   * one.
   */
  it('reports no error for a message it only logged', async () => {
    const offline = await serviceWith({
      ...CONFIGURED,
      RESEND_API_KEY: undefined,
    });

    await expect(
      offline.sendReportEmail({
        to: ['someone@acme.test'],
        subject: 'Weekly report',
        message: 'Here it is',
        senderName: 'Owner',
        senderEmail: 'owner@acme.test',
        organisationName: 'Acme',
        attachment: { filename: 'r.pdf', content: Buffer.from('pdf') },
      }),
    ).resolves.toBe(true);
  });
});

/**
 * Which way mail leaves, and why that order.
 *
 * Hi Day is self-hostable, so requiring an account with one particular
 * hosted provider before the app will start is a poor ask of somebody
 * running it precisely to keep their staff's data in-house. SMTP is spoken
 * by every mail system there is, so it is the way out that needs no
 * third-party signup.
 */
describe('choosing how mail goes out', () => {
  beforeEach(() => {
    sendMock.mockClear();
    smtpSendMail.mockClear();
  });

  it('uses SMTP when a mail server is configured', async () => {
    const service = await serviceWith({
      ...CONFIGURED,
      RESEND_API_KEY: undefined,
      SMTP_HOST: 'smtp.acme.test',
    });

    expect(service.transportName).toBe('smtp');
    expect(service.isDelivering).toBe(true);
  });

  it('uses Resend when only an API key is configured', async () => {
    const service = await serviceWith(CONFIGURED);

    expect(service.transportName).toBe('resend');
    expect(service.isDelivering).toBe(true);
  });

  /**
   * Somebody who filled in their own mail server means to use it. A
   * leftover key from a previous deployment must not quietly override
   * that — and on a self-hosted install, silently routing staff email
   * through a third party would be the worst possible surprise.
   */
  it('prefers SMTP over a leftover Resend key', async () => {
    const service = await serviceWith({
      ...CONFIGURED,
      SMTP_HOST: 'smtp.acme.test',
    });

    expect(service.transportName).toBe('smtp');
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('falls back to the log when neither is configured', async () => {
    const service = await serviceWith({
      ...CONFIGURED,
      RESEND_API_KEY: undefined,
    });

    expect(service.transportName).toBe('console');
    expect(service.isDelivering).toBe(false);
  });

  // Copying .env.example gives blanks, not absent keys.
  it('treats blank settings as unconfigured', async () => {
    const service = await serviceWith({
      ...CONFIGURED,
      RESEND_API_KEY: '  ',
      SMTP_HOST: '  ',
    });

    expect(service.transportName).toBe('console');
  });

  it('starts whichever way is configured, and never throws', async () => {
    for (const env of [
      { SMTP_HOST: 'smtp.acme.test' },
      { RESEND_API_KEY: 're_test_key' },
      {},
    ]) {
      await expect(
        serviceWith({ ...CONFIGURED, RESEND_API_KEY: undefined, ...env }),
      ).resolves.toBeDefined();
    }
  });
});

describe('SMTP messages actually go out', () => {
  beforeEach(() => {
    sendMock.mockClear();
    smtpSendMail.mockClear();
  });

  it('sends a set-password link over SMTP, not to the log', async () => {
    const service = await serviceWith({
      ...CONFIGURED,
      RESEND_API_KEY: undefined,
      SMTP_HOST: 'smtp.acme.test',
    });

    await service.sendSetPasswordEmail('ada@acme.test', 'the-token', 'Acme');

    expect(smtpSendMail).toHaveBeenCalledTimes(1);
    const smtpCalls = smtpSendMail.mock.calls as unknown[][];
    const sent = smtpCalls[0][0] as {
      to: string;
      html: string;
      subject: string;
    };
    expect(sent.to).toBe('ada@acme.test');
    expect(sent.html).toContain('set-password?token=the-token');
    expect(sent.subject).toContain('Acme');
    // The provider that is not in use must not be touched.
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('uses the configured sender address', async () => {
    const service = await serviceWith({
      ...CONFIGURED,
      RESEND_API_KEY: undefined,
      SMTP_HOST: 'smtp.acme.test',
      EMAIL_SENDER: 'Hi Day <noreply@acme.test>',
    });

    await service.sendInvitationEmail('new@acme.test', 'tok', 'Acme');

    expect(smtpSendMail).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'Hi Day <noreply@acme.test>' }),
    );
  });
});
