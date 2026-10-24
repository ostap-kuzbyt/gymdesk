import { describe, expect, it, vi } from "vitest";
import { ConsoleMailer, MailDeliveryError, SendGridMailer, createMailer } from "./mailer.js";
import { testConfig } from "../testing/test-config.js";

const message = {
  to: "olena@example.com",
  subject: "Hello",
  text: "plain body",
  html: "<p>html body</p>",
};

function sendGrid(fetchImpl: typeof fetch) {
  return new SendGridMailer({
    apiKey: "SG.secret",
    fromEmail: "club@example.com",
    fromName: "Iron Works",
    fetch: fetchImpl,
  });
}

describe("ConsoleMailer", () => {
  it("logs the message instead of sending it", async () => {
    const info = vi.fn();

    await new ConsoleMailer({ info }).send(message);

    expect(info).toHaveBeenCalledWith(
      { to: "olena@example.com", subject: "Hello", text: "plain body" },
      expect.stringContaining("not sent"),
    );
  });
});

describe("SendGridMailer", () => {
  it("posts the message to the v3 mail api with the key and plain text before html", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 202 }));

    await sendGrid(fetchMock as unknown as typeof fetch).send(message);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.sendgrid.com/v3/mail/send");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ authorization: "Bearer SG.secret" });
    expect(JSON.parse(init.body as string)).toEqual({
      personalizations: [{ to: [{ email: "olena@example.com" }] }],
      from: { email: "club@example.com", name: "Iron Works" },
      subject: "Hello",
      content: [
        { type: "text/plain", value: "plain body" },
        { type: "text/html", value: "<p>html body</p>" },
      ],
    });
  });

  it("reports the status and a trimmed body when the api refuses the message", async () => {
    const fetchMock = vi.fn(
      async () => new Response("x".repeat(1000), { status: 401 }),
    ) as unknown as typeof fetch;

    const failure = await sendGrid(fetchMock)
      .send(message)
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(MailDeliveryError);
    expect((failure as Error).message).toMatch(/^SendGrid responded with 401: x{300}$/);
  });

  it("wraps network failures", async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;

    await expect(sendGrid(fetchMock).send(message)).rejects.toThrow(
      /could not be reached: fetch failed/,
    );
  });

  it("never leaks the api key into error messages", async () => {
    const fetchMock = vi.fn(
      async () => new Response("denied", { status: 403 }),
    ) as unknown as typeof fetch;

    const failure = await sendGrid(fetchMock)
      .send(message)
      .catch((error: unknown) => error);

    expect((failure as Error).message).not.toContain("SG.secret");
  });
});

describe("createMailer", () => {
  const logger = { info: vi.fn() };

  it("falls back to the console mailer without an api key", () => {
    expect(createMailer(testConfig(), logger)).toBeInstanceOf(ConsoleMailer);
  });

  it("uses SendGrid when a key and sender are configured", () => {
    const config = testConfig({ SENDGRID_API_KEY: "SG.key", MAIL_FROM: "club@example.com" });

    expect(createMailer(config, logger)).toBeInstanceOf(SendGridMailer);
  });
});
