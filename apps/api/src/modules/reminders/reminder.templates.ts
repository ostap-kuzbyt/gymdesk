export interface EmailContent {
  subject: string;
  text: string;
  html: string;
}

export interface ExpiryEmailInput {
  clubName: string;
  memberName: string;
  endsOn: string;
  daysLeft: number;
}

export interface PromoEmailInput {
  clubName: string;
  memberName: string;
  discountPercent: number;
}

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function longDate(isoDate: string): string {
  return dateFormat.format(new Date(`${isoDate}T00:00:00Z`));
}

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

function whenPhrase(daysLeft: number): string {
  if (daysLeft <= 0) return "ends today";
  if (daysLeft === 1) return "ends tomorrow";
  return `ends in ${daysLeft} days`;
}

interface Layout {
  clubName: string;
  heading: string;
  paragraphs: string[];
}

function render(layout: Layout): { html: string; text: string } {
  const paragraphs = layout.paragraphs
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:#2b2b2b;">${escapeHtml(paragraph)}</p>`,
    )
    .join("");

  const html = `<!doctype html>
<html lang="en">
<body style="margin:0;padding:24px;background:#f4f1ea;font-family:Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;">
<tr><td style="padding:20px 32px;background:#1f2421;border-radius:12px 12px 0 0;color:#c6f432;font-size:20px;font-weight:700;">${escapeHtml(layout.clubName)}</td></tr>
<tr><td style="padding:32px;">
<h1 style="margin:0 0 20px;font-size:22px;color:#1f2421;">${escapeHtml(layout.heading)}</h1>
${paragraphs}
</td></tr>
</table>
</td></tr></table>
</body>
</html>`;

  const text = [layout.heading, "", ...layout.paragraphs, "", `- ${layout.clubName}`].join("\n");
  return { html, text };
}

export function expiryEmail(input: ExpiryEmailInput): EmailContent {
  const when = whenPhrase(input.daysLeft);
  const rendered = render({
    clubName: input.clubName,
    heading: `Your subscription ${when}`,
    paragraphs: [
      `Hi ${firstName(input.memberName)},`,
      `Your ${input.clubName} subscription ${when}. Its last day is ${longDate(input.endsOn)}.`,
      "Renew at the front desk to keep training without a break.",
    ],
  });
  return { subject: `Your ${input.clubName} subscription ${when}`, ...rendered };
}

export function promoEmail(input: PromoEmailInput): EmailContent {
  const rendered = render({
    clubName: input.clubName,
    heading: `${input.discountPercent}% off your next subscription`,
    paragraphs: [
      `Hi ${firstName(input.memberName)},`,
      `We would love to keep seeing you at ${input.clubName}. Get ${input.discountPercent}% off your next subscription when you renew at the front desk.`,
    ],
  });
  return {
    subject: `${input.discountPercent}% off your next ${input.clubName} subscription`,
    ...rendered,
  };
}
