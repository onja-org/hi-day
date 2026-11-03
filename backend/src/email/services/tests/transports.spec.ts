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
  html: '<p><a href="http://localhost:3000/set-password?token=abc">http://localhost:3000/set-password?token=abc</a></p>',
};

function fakeNodemailer(sendMail = jest.fn().mockResolvedValue({})) {
  const create = jest.fn().mockReturnValue({ sendMail });
  return { create: create as never, create_: create, sendMail };
}

function optionsFrom(create: jest.Mock): Record<string, unknown> {
  const calls = create.mock.calls as unknown[][];
  return calls[0][0] as Record<string, unknown>;
}

describe('SMTP settings', () => {
  /** Choosing the port is enough: 465 is implicit TLS, 587 upgrades. */
  it('infers TLS from the port, unless told otherwise', () => {
    const a = fakeNodemailer();
    new SmtpTransport({ host: 'h', port: 465 }, a.create);
    expect(optionsFrom(a.create_).secure).toBe(true);

    const b = fakeNodemailer();
    new SmtpTransport({ host: 'h', port: 587 }, b.create);
    expect(optionsFrom(b.create_).secure).toBe(false);

    const c = fakeNodemailer();
    new SmtpTransport({ host: 'h', port: 2525, secure: true }, c.create);
    expect(optionsFrom(c.create_).secure).toBe(true);
  });

  /** Omitted, not blank: a relay that authorises by IP refuses an empty
   * credential. */
  it('sends a login only where one is configured', () => {
    const withUser = fakeNodemailer();
    new SmtpTransport(
      { host: 'h', port: 587, user: 'ada', password: 'hunter2' },
      withUser.create,
    );
    expect(optionsFrom(withUser.create_).auth).toEqual({
      user: 'ada',
      pass: 'hunter2',
    });

    const without = fakeNodemailer();
    new SmtpTransport({ host: 'relay', port: 25 }, without.create);
    expect(optionsFrom(without.create_)).not.toHaveProperty('auth');
  });

  // On only when asked: a bad certificate on a public server is a warning.
  it('accepts an unverifiable certificate only when allowed', () => {
    const off = fakeNodemailer();
    new SmtpTransport({ host: 'h', port: 587 }, off.create);
    expect(optionsFrom(off.create_)).not.toHaveProperty('tls');

    const on = fakeNodemailer();
    new SmtpTransport(
      { host: 'h', port: 587, allowSelfSigned: true },
      on.create,
    );
    expect(optionsFrom(on.create_).tls).toEqual({ rejectUnauthorized: false });
  });
});

describe('SMTP sending', () => {
  it('hands the message over unchanged, attachments included', async () => {
    const { create, sendMail } = fakeNodemailer();
    const transport = new SmtpTransport({ host: 'h', port: 587 }, create);
    const attachments = [{ filename: 'r.pdf', content: Buffer.from('pdf') }];

    await expect(transport.send({ ...MESSAGE, attachments })).resolves.toEqual({
      error: null,
    });
    expect(sendMail).toHaveBeenCalledWith({ ...MESSAGE, attachments });
    expect(transport.delivers).toBe(true);
  });

  /** Answered, not thrown: a failed notice must never fail the invitation
   * or password change behind it. */
  it('answers with an error instead of throwing', async () => {
    const { create } = fakeNodemailer(
      jest.fn().mockRejectedValue(new Error('nope')),
    );
    const transport = new SmtpTransport({ host: 'h', port: 587 }, create);

    expect((await transport.send(MESSAGE)).error?.message).toContain('nope');
  });
});

/** SMTP's own errors name nothing, so each is translated into the setting
 * actually at fault. */
describe('explaining an SMTP failure', () => {
  async function failWith(code: string, errno?: string): Promise<string> {
    const error = Object.assign(new Error('raw detail'), { code, errno });
    const { create } = fakeNodemailer(jest.fn().mockRejectedValue(error));
    const transport = new SmtpTransport({ host: 'h', port: 587 }, create);
    return (await transport.send(MESSAGE)).error!.message;
  }

  it('blames the login, the address, or the TLS settings', async () => {
    expect(await failWith('EAUTH')).toContain('SMTP_USER');
    expect(await failWith('ECONNREFUSED')).toContain('SMTP_HOST');
    expect(await failWith('ESOCKET')).toContain('SMTP_SECURE');
  });

  /**
   * ESOCKET covers both nothing-listening and TLS-refused, so it names both
   * — found by pointing a real backend at a closed port and watching it
   * confidently blame TLS. The errno is believed where it is specific.
   */
  it('names both causes for ESOCKET, unless the errno is specific', async () => {
    expect(await failWith('ESOCKET')).toContain('SMTP_HOST');
    expect(await failWith('ESOCKET', 'ECONNREFUSED')).not.toContain(
      'SMTP_ALLOW_SELF_SIGNED',
    );
  });

  it('never answers with an empty message', async () => {
    const { create } = fakeNodemailer(
      jest.fn().mockRejectedValue(Object.assign(new Error(''), { code: 'X' })),
    );
    const transport = new SmtpTransport({ host: 'h', port: 587 }, create);

    expect((await transport.send(MESSAGE)).error?.message).toBeTruthy();
  });
});

describe('the console transport', () => {
  function transport() {
    const logger = new Logger('test');
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    return { transport: new ConsoleTransport(logger), warn };
  }

  /** The links are the point — without them an operator could create an
   * organisation and never sign in to it. */
  it('logs the link once, with the recipient and subject', async () => {
    const { transport: t, warn } = transport();

    await expect(t.send(MESSAGE)).resolves.toEqual({ error: null });

    const logged = String((warn.mock.calls[0] as unknown[])[0]);
    expect(logged).toContain('ada@acme.test');
    expect(logged).toContain('Set your password for Acme');
    // Appears twice in the markup, as href and link text.
    expect(logged.split('set-password?token=abc').length - 1).toBe(1);
    expect(t.delivers).toBe(false);
  });

  it('joins several recipients', async () => {
    const { transport: t, warn } = transport();

    await t.send({ ...MESSAGE, to: ['a@acme.test', 'b@acme.test'] });

    expect(String((warn.mock.calls[0] as unknown[])[0])).toContain(
      'a@acme.test, b@acme.test',
    );
  });
});
