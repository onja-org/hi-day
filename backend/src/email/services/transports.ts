import { Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { createTransport, type Transporter } from 'nodemailer';

/** Shaped the way nodemailer takes it; Pigeon's JSON is mapped from it. */
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
 * SMTP, Pigeon, or nowhere — chosen once at start-up by `EmailService`.
 * SMTP exists so a self-hoster can use the mail system they already have
 * rather than opening an account with one specific provider.
 */
export interface MailTransport {
  readonly name: 'smtp' | 'pigeon' | 'console';
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

export interface PigeonSettings {
  /** e.g. https://pigeon.onja.dev — no trailing path. */
  baseUrl: string;
  /** A project key, `es_live_…`. */
  apiKey: string;
}

/** How long one attempt may take, and how many attempts in all. */
const PIGEON_TIMEOUT_MS = 10_000;
const PIGEON_ATTEMPTS = 3;

interface PigeonErrorBody {
  error?: { code?: string; message?: string };
}

interface PigeonEmail {
  status?: string;
  suppressed_recipients?: string[];
}

class PigeonRequestError extends Error {
  constructor(
    message: string,
    /** Network errors and 5xx: the same request may well work again. */
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

/**
 * Onja's email service (https://pigeon.onja.dev/docs) — what hiday Cloud
 * uses. One JSON call per message; Pigeon queues, sends, retries delivery
 * and skips addresses that have bounced or complained.
 */
export class PigeonTransport implements MailTransport {
  readonly name = 'pigeon' as const;
  readonly delivers = true;

  private readonly baseUrl: string;

  constructor(
    private readonly settings: PigeonSettings,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly pause: (ms: number) => Promise<void> = (ms) =>
      new Promise((resolve) => setTimeout(resolve, ms)),
  ) {
    this.baseUrl = settings.baseUrl.replace(/\/+$/, '');
  }

  async send(message: MailMessage): Promise<MailResult> {
    // One key for every attempt: an attempt whose answer was lost may still
    // have queued the email, and Pigeon answers a repeated key with the
    // email it already has instead of sending a second one.
    const body = JSON.stringify({
      from: message.from,
      to: Array.isArray(message.to) ? message.to : [message.to],
      ...(message.replyTo ? { reply_to: [message.replyTo] } : {}),
      subject: message.subject,
      html: message.html,
      ...(message.attachments?.length
        ? {
            attachments: message.attachments.map((file) => ({
              filename: file.filename,
              content: file.content.toString('base64'),
            })),
          }
        : {}),
      idempotency_key: randomUUID(),
    });

    for (let attempt = 1; ; attempt++) {
      try {
        const email = await this.post(body);
        if (email.status === 'suppressed') {
          // Pigeon answers success, but nothing went: every recipient has
          // bounced or complained before.
          const who = email.suppressed_recipients?.join(', ') ?? 'recipient';
          return {
            error: {
              message: `Not sent: ${who} bounced or marked an earlier email as spam, so Pigeon no longer mails ${email.suppressed_recipients?.length === 1 ? 'that address' : 'those addresses'}.`,
            },
          };
        }
        return { error: null };
      } catch (error) {
        const failure =
          error instanceof PigeonRequestError
            ? error
            : new PigeonRequestError(String(error), false);
        if (!failure.retryable || attempt >= PIGEON_ATTEMPTS) {
          // Answered, not thrown: a failed notice must never fail the
          // invitation or password change behind it.
          return { error: { message: failure.message } };
        }
        await this.pause(250 * 2 ** attempt);
      }
    }
  }

  private async post(body: string): Promise<PigeonEmail> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/v1/emails`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.settings.apiKey}`,
          'content-type': 'application/json',
        },
        body,
        signal: AbortSignal.timeout(PIGEON_TIMEOUT_MS),
      });
    } catch (error) {
      const raw = error instanceof Error ? error.message : String(error);
      throw new PigeonRequestError(
        `Could not reach Pigeon at ${this.baseUrl}. Check PIGEON_URL, and that this server is allowed to connect out. (${raw})`,
        true,
      );
    }

    const data = (await response.json().catch(() => null)) as
      (PigeonEmail & PigeonErrorBody) | null;
    if (response.ok) return data ?? {};
    throw new PigeonRequestError(
      describePigeonFailure(response.status, data),
      response.status >= 500,
    );
  }
}

/** Names the setting at fault where the answer points at one. */
function describePigeonFailure(
  status: number,
  body: PigeonErrorBody | null,
): string {
  const code = body?.error?.code;
  const raw = body?.error?.message;
  const detail = raw ? ` (${raw})` : '';

  if (status === 401) {
    return `Pigeon rejected the API key. Check PIGEON_KEY.${detail}`;
  }
  if (code === 'sender_domain_not_allowed') {
    return `Pigeon won't send from this address. EMAIL_SENDER must be on a domain verified for this Pigeon project.${detail}`;
  }
  if (code === 'invalid_from') {
    return `EMAIL_SENDER isn't a valid address.${detail}`;
  }
  return `Pigeon refused the email: ${status}${code ? ` ${code}` : ''}${detail}`;
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
