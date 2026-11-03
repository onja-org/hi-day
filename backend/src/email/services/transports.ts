import { Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import { Resend } from 'resend';

/**
 * One message, in the shape every transport below understands.
 *
 * Deliberately the small set the app actually sends. Resend and nodemailer
 * happen to name all of these identically — attachments included — so there
 * is no translation layer here, and adding a field means adding it in one
 * place.
 */
export interface MailMessage {
  from: string;
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
  attachments?: { filename: string; content: Buffer }[];
}

/** What a transport answers. Null error means the message went. */
export interface MailResult {
  error: { message: string } | null;
}

/**
 * How mail leaves this installation — or doesn't.
 *
 * Three implementations, chosen once at start-up by `EmailService`:
 *
 * - **SMTP**, for a self-hosted install using the mail system it already
 *   has. The reason this interface exists: requiring one specific hosted
 *   provider is a poor ask of somebody running Hi Day to keep their staff's
 *   data in-house, and SMTP is spoken by every mail system there is.
 * - **Resend**, which Hi Day Cloud uses.
 * - **Console**, which sends nothing and logs instead, so the app runs with
 *   no mail configuration at all.
 */
export interface MailTransport {
  /** For start-up logging and `EmailService.isDelivering`. */
  readonly name: 'smtp' | 'resend' | 'console';
  /** Whether mail actually reaches anybody. False for console only. */
  readonly delivers: boolean;
  send(message: MailMessage): Promise<MailResult>;
}

/** Everything needed to reach a mail server. */
export interface SmtpSettings {
  host: string;
  port: number;
  user?: string;
  password?: string;
  /**
   * Implicit TLS from the first byte — port 465's convention. Left unset,
   * it is inferred from the port, because that is the thing people get
   * wrong and the port already says which one they meant.
   */
  secure?: boolean;
  /**
   * Accept a certificate that does not verify. Off by default and never
   * on by accident: an internal mail server with a self-signed certificate
   * is a real and common case, but so is a misconfigured public one, and
   * only the operator can tell those apart.
   */
  allowSelfSigned?: boolean;
}

/**
 * Mail through any SMTP server: a company mail server, Google Workspace,
 * Microsoft 365, Mailgun, SES — all of them speak it.
 *
 * Port 587 with STARTTLS is the default elsewhere in the config because it
 * is what most providers want. 465 means implicit TLS instead, and `secure`
 * is inferred from the port so that choosing the port is enough.
 */
export class SmtpTransport implements MailTransport {
  readonly name = 'smtp' as const;
  readonly delivers = true;

  private readonly transporter: Transporter;

  constructor(
    settings: SmtpSettings,
    /** Injected by tests so no connection is attempted. */
    create: typeof createTransport = createTransport,
  ) {
    this.transporter = create({
      host: settings.host,
      port: settings.port,
      // 465 is implicit TLS; everything else starts plain and upgrades.
      secure: settings.secure ?? settings.port === 465,
      // Omitted entirely for a server that wants no login — an internal
      // relay that authorises by IP. An empty user would be sent as a
      // credential and refused.
      ...(settings.user
        ? { auth: { user: settings.user, pass: settings.password ?? '' } }
        : {}),
      ...(settings.allowSelfSigned
        ? { tls: { rejectUnauthorized: false } }
        : {}),
    });
  }

  async send(message: MailMessage): Promise<MailResult> {
    try {
      await this.transporter.sendMail(message);
      return { error: null };
    } catch (error) {
      // Answered rather than thrown, because that is the contract every
      // caller already handles: a failed notice is logged, never a reason
      // to fail the invitation or password change behind it.
      return { error: { message: describeSmtpFailure(error) } };
    }
  }
}

/**
 * Turns a connection failure into something that names the setting at
 * fault.
 *
 * SMTP's errors are famously unhelpful, and the three below account for
 * most first-time failures. A raw TLS stack trace tells an operator
 * nothing about which of five variables they typed wrongly.
 */
function describeSmtpFailure(error: unknown): string {
  const details = error as { code?: string; errno?: string } | null;
  // `errno` carries the real cause where `code` is the generic ESOCKET —
  // a refused connection and a failed handshake both arrive as ESOCKET.
  const code = details?.code;
  const errno = details?.errno;
  const raw = error instanceof Error ? error.message : String(error);
  const detail = raw ? ` (${raw})` : '';

  if (
    code === 'ESOCKET' &&
    errno &&
    ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EHOSTUNREACH'].includes(errno)
  ) {
    return `Could not reach the SMTP server (${errno}). Check SMTP_HOST and SMTP_PORT, and that this server is allowed to connect out.${detail}`;
  }

  switch (code) {
    case 'EAUTH':
      return `SMTP rejected the login. Check SMTP_USER and SMTP_PASSWORD — Gmail and Microsoft 365 need an app password, not your normal one.${detail}`;
    case 'ECONNREFUSED':
    case 'ETIMEDOUT':
    case 'ENOTFOUND':
    case 'EHOSTUNREACH':
    case 'EDNS':
      return `Could not reach the SMTP server. Check SMTP_HOST and SMTP_PORT, and that this server is allowed to connect out.${detail}`;
    case 'ESOCKET':
    case 'EPROTO':
      // Names both, because ESOCKET genuinely covers both: nothing
      // listening on that port, and a port that answered but would not
      // negotiate TLS. Guessing one would send the reader the wrong way.
      return `SMTP connection failed. Either nothing is listening — check SMTP_HOST and SMTP_PORT — or TLS could not be negotiated: port 465 needs SMTP_SECURE=true, port 587 needs it false, and a self-signed certificate needs SMTP_ALLOW_SELF_SIGNED=true.${detail}`;
    default:
      return raw || 'SMTP failed without saying why.';
  }
}

/** Mail through Resend's API. What Hi Day Cloud uses. */
export class ResendTransport implements MailTransport {
  readonly name = 'resend' as const;
  readonly delivers = true;

  private readonly client: Resend;

  constructor(apiKey: string) {
    this.client = new Resend(apiKey);
  }

  async send(message: MailMessage): Promise<MailResult> {
    const { error } = await this.client.emails.send(message);
    return { error: error ? { message: error.message } : null };
  }
}

/**
 * Sends nothing and writes the message to the log, links first.
 *
 * The links are the point. Setting a first password, accepting an
 * invitation and confirming a deletion are each only completable through a
 * one-time URL. Without this an operator could create an organisation and
 * never be able to sign in to it.
 *
 * Logged at warn, not log, so it stands out in a deployment that *does*
 * intend to send mail and has simply lost its configuration.
 */
export class ConsoleTransport implements MailTransport {
  readonly name = 'console' as const;
  readonly delivers = false;

  constructor(private readonly logger: Logger) {}

  send(message: MailMessage): Promise<MailResult> {
    const to = Array.isArray(message.to) ? message.to.join(', ') : message.to;
    const links = [
      ...String(message.html ?? '').matchAll(/https?:\/\/[^"'<>\s]+/g),
    ]
      .map((match) => match[0])
      // The same URL usually appears twice, as the href and the link text.
      .filter((url, index, all) => all.indexOf(url) === index);

    this.logger.warn(
      [
        'No email provider is configured, so this email was not sent:',
        `  to:      ${to}`,
        `  subject: ${message.subject}`,
        ...(links.length > 0
          ? ['  links:', ...links.map((url) => `    ${url}`)]
          : []),
      ].join('\n'),
    );

    return Promise.resolve({ error: null });
  }
}
