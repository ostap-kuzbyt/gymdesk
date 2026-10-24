import { describe, expect, it } from "vitest";
import { escapeHtml, expiryEmail, promoEmail } from "./reminder.templates.js";

const base = { clubName: "Iron Works", memberName: "Olena Shevchenko" };

describe("expiryEmail", () => {
  it("names the member, the club and the last day", () => {
    const email = expiryEmail({ ...base, endsOn: "2026-10-30", daysLeft: 5 });

    expect(email.subject).toBe("Your Iron Works subscription ends in 5 days");
    expect(email.text).toContain("Hi Olena,");
    expect(email.text).toContain("30 October 2026");
    expect(email.html).toContain("30 October 2026");
    expect(email.html).toContain("Iron Works");
  });

  it.each([
    [0, "Your Iron Works subscription ends today"],
    [1, "Your Iron Works subscription ends tomorrow"],
    [2, "Your Iron Works subscription ends in 2 days"],
  ])("words %i days left as %j", (daysLeft, subject) => {
    expect(expiryEmail({ ...base, endsOn: "2026-10-30", daysLeft }).subject).toBe(subject);
  });

  it("escapes markup in names so it cannot inject html", () => {
    const email = expiryEmail({
      clubName: "Gym <b>One</b>",
      memberName: '<script>alert("x")</script> Smith',
      endsOn: "2026-10-30",
      daysLeft: 3,
    });

    expect(email.html).not.toContain("<script>");
    expect(email.html).not.toContain("<b>One</b>");
    expect(email.html).toContain("&lt;script&gt;");
  });

  it("produces a complete html document with a plain-text twin", () => {
    const email = expiryEmail({ ...base, endsOn: "2026-10-30", daysLeft: 5 });

    expect(email.html.startsWith("<!doctype html>")).toBe(true);
    expect(email.text).not.toContain("<");
  });
});

describe("promoEmail", () => {
  it("states the discount in the subject and the body", () => {
    const email = promoEmail({ ...base, discountPercent: 15 });

    expect(email.subject).toBe("15% off your next Iron Works subscription");
    expect(email.text).toContain("15%");
    expect(email.html).toContain("15% off your next subscription");
  });
});

describe("escapeHtml", () => {
  it("escapes the five html-significant characters", () => {
    expect(escapeHtml(`<a href="x">Tom & 'Jerry'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/a&gt;",
    );
  });
});
