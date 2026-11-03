import { Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import { Resend } from 'resend';

/** Resend and nodemailer name all of these identically, so no translation
 * layer is needed. */
export interface MailMessage {
  from: string;
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
  attachments?: { filename: string; content: Buffer }[];
}

/** Null error means the message went. */
export interface MailResult {
  error: { message: string } | null;
}

/**
 * SMTP, Resend, or nowhere — chosen once at start-up by `EmailService`.
 * SMTP exists so a self-hoster can use the mail system they already have
 * rather than opening an account with one specific provider.
 */
export interface MailTransport {
  readonly name: 'smtp' | 'resend' | 'console';
  /** False for console only. */
  readonly delivers: boolean;
  send(message: MailMessage): Promise<MailResult>;
}

export interface SmtpSettings {
  host: string;
  port: number;
  user?: string;
  password?: string;
  /** Unset means inferred from the port (true for 465). */
  secure?: boolean;
  /** For an internal server with a self-signed certificate. */
  allowSelfSigned?: boolean;
}

/** Mail through any SMTP server. */
export class SmtpTransport implements MailTransport {
  readonly name = 'smtp' as const;
  readonly delivers = true;

  private readonly transporter: Transporter;

  constructor(
    settings: SmtpSettings,
    create: typeof createTransport = createTransport,
  ) {
    this.transporter = create({
      host: settings.host,
      port: settings.port,
      secure: settings.secure ?? settings.port === 465,
      // Omitted, not blank: a relay that authorises by IP refuses an empty
      // credential.
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
      // Answered, not thrown: a failed notice must never fail the
      // invitation or password change behind it.
      return { error: { message: describeSmtpFailure(error) } };
    }
  }
}

/** Names the setting at fault, since SMTP's own errors name nothing. */
function describeSmtpFailure(error: unknown): string {
  const details = error as { code?: string; errno?: string } | null;
  // ESOCKET covers both a refused connection and a failed handshake;
  // `errno` is what tells them apart.
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
      return `SMTP connection failed. Either nothing is listening — check SMTP_HOST and SMTP_PORT — or TLS could not be negotiated: port 465 needs SMTP_SECURE=true, port 587 needs it false, and a self-signed certificate needs SMTP_ALLOW_SELF_SIGNED=true.${detail}`;
    default:
      return raw || 'SMTP failed without saying why.';
  }
}

/** What Hi Day Cloud uses. */
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
 * Sends nothing and logs the message, links first. Setting a first password
 * and accepting an invitation are only completable through a one-time URL,
 * so without this an operator could create an organisation and never sign
 * in to it.
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
      // Appears twice in the markup, as href and link text.
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
