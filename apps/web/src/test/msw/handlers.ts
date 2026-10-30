import { HttpResponse, http } from "msw";
import type { HttpResponseResolver, PathParams } from "msw";
import * as data from "@/test/fixtures";

const TOKEN = "Bearer test-token";

function guarded(resolver: HttpResponseResolver<PathParams>): HttpResponseResolver<PathParams> {
  return (info) => {
    if (info.request.headers.get("authorization") !== TOKEN) {
      return HttpResponse.json(
        { title: "Unauthorized", status: 401, detail: "A bearer token is required" },
        { status: 401 },
      );
    }
    return resolver(info);
  };
}

const get = (path: string, resolver: HttpResponseResolver<PathParams>) =>
  http.get(path, guarded(resolver));
const post = (path: string, resolver: HttpResponseResolver<PathParams>) =>
  http.post(path, guarded(resolver));
const patch = (path: string, resolver: HttpResponseResolver<PathParams>) =>
  http.patch(path, guarded(resolver));
const put = (path: string, resolver: HttpResponseResolver<PathParams>) =>
  http.put(path, guarded(resolver));

const notFound = (what: string) =>
  HttpResponse.json(
    { title: "Not Found", status: 404, detail: `${what} was not found` },
    { status: 404 },
  );

function page<T>(items: T[], url: URL) {
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const limit = Number(url.searchParams.get("limit") ?? 25);
  return { items: items.slice(offset, offset + limit), total: items.length };
}

export const handlers = [
  get("/api/tariffs", ({ request }) => {
    const all = new URL(request.url).searchParams.get("includeArchived") === "true";
    return HttpResponse.json(data.tariffs.filter((tariff) => all || !tariff.archived));
  }),
  post("/api/tariffs", async ({ request }) =>
    HttpResponse.json(
      { ...data.tariffs[0], ...((await request.json()) as object), id: data.ids.tariffTen },
      { status: 201 },
    ),
  ),
  patch("/api/tariffs/:id", async ({ request }) =>
    HttpResponse.json({ ...data.tariffs[0], ...((await request.json()) as object) }),
  ),
  post("/api/tariffs/:id/archive", () => HttpResponse.json({ ...data.tariffs[0], archived: true })),

  get("/api/studios", ({ request }) => {
    const all = new URL(request.url).searchParams.get("includeArchived") === "true";
    return HttpResponse.json(data.studios.filter((studio) => all || !studio.archived));
  }),
  post("/api/studios", async ({ request }) =>
    HttpResponse.json(
      { ...data.studios[0], ...((await request.json()) as object) },
      { status: 201 },
    ),
  ),

  get("/api/coaches", () => HttpResponse.json(data.coaches)),
  get("/api/coaches/:id", ({ params }) => {
    const coach = data.coaches.find((item) => item.id === params.id);
    return coach ? HttpResponse.json(coach) : notFound("Coach");
  }),
  get("/api/coaches/:id/members", ({ request, params }) => {
    const mine = data.members
      .filter((member) => member.coachId === params.id)
      .map(data.memberListItem);
    return HttpResponse.json(page(mine, new URL(request.url)));
  }),

  get("/api/members", ({ request }) => {
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").toLowerCase();
    const expiring = url.searchParams.get("expiringWithinDays");
    const matching = data.members
      .map(data.memberListItem)
      .filter((member) => member.fullName.toLowerCase().includes(q) || member.email.includes(q))
      .filter(
        (member) =>
          !expiring ||
          (member.activeUntil !== null && member.activeUntil <= addDaysIso(Number(expiring))),
      );
    return HttpResponse.json(page(matching, url));
  }),
  post("/api/members", async ({ request }) =>
    HttpResponse.json(
      { ...data.members[2], ...((await request.json()) as object) },
      { status: 201 },
    ),
  ),
  get("/api/members/:id", ({ params }) => {
    const member = data.members.find((item) => item.id === params.id);
    return member ? HttpResponse.json(member) : notFound("Member");
  }),
  patch("/api/members/:id", async ({ request, params }) => {
    const member = data.members.find((item) => item.id === params.id);
    return member
      ? HttpResponse.json({ ...member, ...((await request.json()) as object) })
      : notFound("Member");
  }),
  put("/api/members/:id/coach", ({ params }) => {
    const member = data.members.find((item) => item.id === params.id);
    return member ? HttpResponse.json(member) : notFound("Member");
  }),
  get("/api/members/:id/check-ins", ({ request }) =>
    HttpResponse.json(page(data.visits, new URL(request.url))),
  ),
  post("/api/members/:id/check-ins", ({ params }) =>
    HttpResponse.json(
      {
        id: data.ids.reminderSent,
        memberId: params.id,
        subscriptionId: data.ids.subscriptionOlena,
        visitDate: data.today,
        checkedInAt: new Date().toISOString(),
      },
      { status: 201 },
    ),
  ),
  post("/api/members/:id/subscriptions", ({ params }) => {
    const member = data.members.find((item) => item.id === params.id);
    return member ? HttpResponse.json(member, { status: 201 }) : notFound("Member");
  }),
  post("/api/members/:id/reminders", () => HttpResponse.json(data.reminders[0], { status: 201 })),

  get("/api/workouts", ({ request }) => {
    const url = new URL(request.url);
    const from = url.searchParams.get("from") ?? "";
    const to = url.searchParams.get("to") ?? "";
    return HttpResponse.json(
      data.workouts.filter((workout) => workout.date >= from && workout.date <= to),
    );
  }),
  get("/api/workouts/:id", ({ params }) => {
    const workout = data.workouts.find((item) => item.id === params.id);
    return workout ? HttpResponse.json(data.workoutView(workout)) : notFound("Workout");
  }),

  get("/api/reminders", ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const kind = url.searchParams.get("kind");
    const matching = data.reminders.filter(
      (item) => (!status || item.status === status) && (!kind || item.kind === kind),
    );
    return HttpResponse.json(page(matching, url));
  }),
  post("/api/reminders/scan", () =>
    HttpResponse.json({ date: data.today, considered: 2, sent: 1, failed: 0, skipped: 1 }),
  ),

  get("/api/reports/attendance", ({ request }) => {
    const url = new URL(request.url);
    const report = data.attendance(
      url.searchParams.get("from") ?? data.today,
      url.searchParams.get("to") ?? data.today,
    );
    return HttpResponse.json({ ...report, ...page(report.items, url) });
  }),
  get("/api/reports/revenue", ({ request }) =>
    HttpResponse.json(
      data.revenue(
        new URL(request.url).searchParams.get("granularity") === "year" ? "year" : "month",
      ),
    ),
  ),
  get("/api/reports/load", ({ request }) => {
    const url = new URL(request.url);
    return HttpResponse.json(
      data.load(
        url.searchParams.get("from") ?? data.today,
        url.searchParams.get("to") ?? data.today,
      ),
    );
  }),
];

function addDaysIso(days: number): string {
  const date = new Date(`${data.today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
