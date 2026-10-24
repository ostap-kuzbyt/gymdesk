import type { Config } from "./config.js";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface Mailer {
  send: (message: MailMessage) => Promise<void>;
}

export interface MailLogger {
  info: (details: Record<string, unknown>, message: string) => void;
}

export class MailDeliveryError extends Error {
  override readonly name = "MailDeliveryError";
}

export class ConsoleMailer implements Mailer {
  constructor(private readonly logger: MailLogger) {}

  async send(message: MailMessage): Promise<void> {
    this.logger.info(
      { to: message.to, subject: message.subject, text: message.text },
      "Email not sent because no mail provider is configured",
    );
  }
}

export interface SendGridOptions {
  apiKey: string;
  fromEmail: string;
  fromName: string;
  fetch?: typeof fetch;
}

const SENDGRID_URL = "https://api.sendgrid.com/v3/mail/send";
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_ERROR_BODY = 300;

export class SendGridMailer implements Mailer {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: SendGridOptions) {
    this.fetchImpl = options.fetch ?? fetch;
  }

  async send(message: MailMessage): Promise<void> {
    let response: Response;
    try {
      response = await this.fetchImpl(SENDGRID_URL, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.options.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: message.to }] }],
          from: { email: this.options.fromEmail, name: this.options.fromName },
          subject: message.subject,
          content: [
            { type: "text/plain", value: message.text },
            { type: "text/html", value: message.html },
          ],
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown error";
      throw new MailDeliveryError(`SendGrid could not be reached: ${reason}`, { cause: error });
    }

    if (!response.ok) {
      const body = (await response.text().catch(() => "")).slice(0, MAX_ERROR_BODY);
      throw new MailDeliveryError(`SendGrid responded with ${response.status}: ${body}`);
    }
  }
}

export function createMailer(config: Config, logger: MailLogger, fetchImpl?: typeof fetch): Mailer {
  if (config.SENDGRID_API_KEY && config.MAIL_FROM) {
    return new SendGridMailer({
      apiKey: config.SENDGRID_API_KEY,
      fromEmail: config.MAIL_FROM,
      fromName: config.CLUB_NAME,
      ...(fetchImpl ? { fetch: fetchImpl } : {}),
    });
  }
  return new ConsoleMailer(logger);
}
