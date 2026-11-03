import { Logger } from '@nestjs/common';
import {
  ConsoleTransport,
  SmtpTransport,
  type MailMessage,
} from '../transports';

const MESSAGE: MailMessage = {
  from: 'Hi Day <noreply@acme.test>',
  to: 'ada@acme.test',
  subject: 'Set your password for Acme',
  html: '<p>Welcome.</p><p><a href="http://localhost:3000/set-password?token=abc">http://localhost:3000/set-password?token=abc</a></p>',
};

/** A nodemailer stand-in, so no connection is attempted. */
function fakeNodemailer(sendMail = jest.fn().mockResolvedValue({})) {
  const create = jest.fn().mockReturnValue({ sendMail });
  return { create: create as never, create_: create, sendMail };
}

function optionsFrom(create: jest.Mock): Record<string, unknown> {
  const calls = create.mock.calls as unknown[][];
  return calls[0][0] as Record<string, unknown>;
}

describe('SMTP: how settings reach the mail server', () => {
  it('passes the host and port straight through', () => {
    const { create, create_ } = fakeNodemailer();

    new SmtpTransport({ host: 'smtp.acme.test', port: 587 }, create);

    expect(optionsFrom(create_)).toMatchObject({
      host: 'smtp.acme.test',
      port: 587,
    });
  });

  /**
   * 465 means implicit TLS, 587 means start plain and upgrade. Choosing
   * the port is enough — this is the setting people get wrong, and the
   * port already says which one they meant.
   */
  it('infers implicit TLS from port 465', () => {
    const { create, create_ } = fakeNodemailer();

    new SmtpTransport({ host: 'smtp.acme.test', port: 465 }, create);

    expect(optionsFrom(create_).secure).toBe(true);
  });

  it('infers STARTTLS from port 587', () => {
    const { create, create_ } = fakeNodemailer();

    new SmtpTransport({ host: 'smtp.acme.test', port: 587 }, create);

    expect(optionsFrom(create_).secure).toBe(false);
  });

  // An explicit answer beats the guess, for a server on a non-standard port.
  it('lets an explicit setting override the port’s convention', () => {
    const { create, create_ } = fakeNodemailer();

    new SmtpTransport(
      { host: 'smtp.acme.test', port: 2525, secure: true },
      create,
    );

    expect(optionsFrom(create_).secure).toBe(true);
  });

  it('sends the login where one is configured', () => {
    const { create, create_ } = fakeNodemailer();

    new SmtpTransport(
      { host: 'smtp.acme.test', port: 587, user: 'ada', password: 'hunter2' },
      create,
    );

    expect(optionsFrom(create_).auth).toEqual({
      user: 'ada',
      pass: 'hunter2',
    });
  });

  /**
   * Omitted entirely, not sent empty: an internal relay that authorises by
   * IP wants no login at all, and an empty username is a credential it
   * would refuse.
   */
  it('sends no login where there is no user', () => {
    const { create, create_ } = fakeNodemailer();

    new SmtpTransport({ host: 'relay.internal', port: 25 }, create);

    expect(optionsFrom(create_)).not.toHaveProperty('auth');
  });

  // Off unless asked for: a self-signed certificate on an internal server
  // is a real case, but so is a misconfigured public one.
  it('rejects an unverifiable certificate by default', () => {
    const { create, create_ } = fakeNodemailer();

    new SmtpTransport({ host: 'smtp.acme.test', port: 587 }, create);

    expect(optionsFrom(create_)).not.toHaveProperty('tls');
  });

  it('accepts one only when explicitly allowed', () => {
    const { create, create_ } = fakeNodemailer();

    new SmtpTransport(
      { host: 'mail.internal', port: 587, allowSelfSigned: true },
      create,
    );

    expect(optionsFrom(create_).tls).toEqual({ rejectUnauthorized: false });
  });
});

describe('SMTP: sending', () => {
  it('hands the message over unchanged', async () => {
    const { create, sendMail } = fakeNodemailer();
    const transport = new SmtpTransport(
      { host: 'smtp.acme.test', port: 587 },
      create,
    );

    await expect(transport.send(MESSAGE)).resolves.toEqual({ error: null });
    expect(sendMail).toHaveBeenCalledWith(MESSAGE);
  });

  it('carries an attachment through', async () => {
    const { create, sendMail } = fakeNodemailer();
    const transport = new SmtpTransport(
      { host: 'smtp.acme.test', port: 587 },
      create,
    );
    const attachments = [
      { filename: 'report.pdf', content: Buffer.from('pdf') },
    ];

    await transport.send({ ...MESSAGE, attachments });

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ attachments }),
    );
  });

  it('reports delivering', () => {
    const { create } = fakeNodemailer();

    const transport = new SmtpTransport(
      { host: 'smtp.acme.test', port: 587 },
      create,
    );

    expect(transport.delivers).toBe(true);
    expect(transport.name).toBe('smtp');
  });

  /**
   * Answered, never thrown. Every caller treats a failed notice as worth
   * logging and never as a reason to fail the invitation or password
   * change behind it.
   */
  it('answers with an error instead of throwing', async () => {
    const sendMail = jest.fn().mockRejectedValue(new Error('nope'));
    const { create } = fakeNodemailer(sendMail);
    const transport = new SmtpTransport(
      { host: 'smtp.acme.test', port: 587 },
      create,
    );

    const result = await transport.send(MESSAGE);

    expect(result.error?.message).toContain('nope');
  });
});

/**
 * SMTP's own errors name nothing useful. These three account for most
 * first-time failures, and each names the setting actually at fault — a raw
 * TLS stack trace tells an operator nothing about which of five variables
 * they typed wrongly.
 */
describe('SMTP: explaining a failure', () => {
  async function failWith(code: string, errno?: string): Promise<string> {
    const error = Object.assign(new Error('raw detail'), { code, errno });
    const { create } = fakeNodemailer(jest.fn().mockRejectedValue(error));
    const transport = new SmtpTransport(
      { host: 'smtp.acme.test', port: 587 },
      create,
    );
    const result = await transport.send(MESSAGE);
    return result.error!.message;
  }

  it('blames the login for an auth failure', async () => {
    const message = await failWith('EAUTH');

    expect(message).toContain('SMTP_USER');
    expect(message).toContain('app password');
  });

  it('blames the address for a connection failure', async () => {
    for (const code of ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND']) {
      expect(await failWith(code)).toContain('SMTP_HOST');
    }
  });

  /**
   * ESOCKET covers both "nothing is listening" and "TLS would not
   * negotiate", so it names both rather than confidently picking one and
   * sending the reader the wrong way. This was found by pointing a real
   * backend at a closed port: it blamed TLS when the port was the problem.
   */
  it('names both causes for the ambiguous socket failure', async () => {
    const message = await failWith('ESOCKET');

    expect(message).toContain('SMTP_HOST');
    expect(message).toContain('SMTP_SECURE');
    expect(message).toContain('SMTP_ALLOW_SELF_SIGNED');
  });

  // Where the underlying errno does say, it is believed over the generic code.
  it('blames the address when the errno names a connection failure', async () => {
    const message = await failWith('ESOCKET', 'ECONNREFUSED');

    expect(message).toContain('Could not reach the SMTP server');
    expect(message).toContain('ECONNREFUSED');
    expect(message).not.toContain('SMTP_ALLOW_SELF_SIGNED');
  });

  // An error with no message at all must still say something.
  it('never answers with an empty string', async () => {
    const { create } = fakeNodemailer(
      jest.fn().mockRejectedValue(Object.assign(new Error(''), { code: 'X' })),
    );
    const transport = new SmtpTransport(
      { host: 'smtp.acme.test', port: 587 },
      create,
    );

    const result = await transport.send(MESSAGE);

    expect(result.error?.message).toBeTruthy();
  });

  // Still says what went wrong, rather than swallowing it.
  it('passes an unrecognised failure through verbatim', async () => {
    expect(await failWith('EWHATEVER')).toBe('raw detail');
  });
});

describe('the console transport', () => {
  function transport() {
    const logger = new Logger('test');
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    return { transport: new ConsoleTransport(logger), warn };
  }

  it('does not deliver, and says so', () => {
    expect(transport().transport.delivers).toBe(false);
    expect(transport().transport.name).toBe('console');
  });

  /** The links are the point — see the class comment. */
  it('logs the link, the recipient and the subject', async () => {
    const { transport: t, warn } = transport();

    await t.send(MESSAGE);

    const logged = String((warn.mock.calls[0] as unknown[])[0]);
    expect(logged).toContain('http://localhost:3000/set-password?token=abc');
    expect(logged).toContain('ada@acme.test');
    expect(logged).toContain('Set your password for Acme');
  });

  // The same URL appears twice in the markup, as href and link text.
  it('lists each link once', async () => {
    const { transport: t, warn } = transport();

    await t.send(MESSAGE);

    const logged = String((warn.mock.calls[0] as unknown[])[0]);
    const occurrences = logged.split('set-password?token=abc').length - 1;
    expect(occurrences).toBe(1);
  });

  it('joins several recipients', async () => {
    const { transport: t, warn } = transport();

    await t.send({ ...MESSAGE, to: ['a@acme.test', 'b@acme.test'] });

    expect(String((warn.mock.calls[0] as unknown[])[0])).toContain(
      'a@acme.test, b@acme.test',
    );
  });

  it('reports no error, because nothing went wrong for the caller', async () => {
    await expect(transport().transport.send(MESSAGE)).resolves.toEqual({
      error: null,
    });
  });
});
