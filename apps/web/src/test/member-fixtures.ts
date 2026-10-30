import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { addDays } from "@/lib/dates";
import { todayLocal } from "@/lib/format";
import { json, mockApi } from "./mock-api";
import { renderApp } from "./render-app";
import type { RenderOptions } from "./render-app";

export const today = todayLocal();
export const MEMBER_ID = "6f1d7a52-2f0f-4a43-9a53-5d9b1a9b0001";
export const MONTHLY = "6f1d7a52-2f0f-4a43-9a53-5d9b1a9b0101";
export const QUARTERLY = "6f1d7a52-2f0f-4a43-9a53-5d9b1a9b0102";
export const ACTIVE_SUB = "6f1d7a52-2f0f-4a43-9a53-5d9b1a9b0201";
export const OLD_SUB = "6f1d7a52-2f0f-4a43-9a53-5d9b1a9b0202";
export const IVAN = "6f1d7a52-2f0f-4a43-9a53-5d9b1a9b0301";
export const OLHA = "6f1d7a52-2f0f-4a43-9a53-5d9b1a9b0302";

export interface MemberState {
  id: string;
  coachId: string | null;
  fullName: string;
  birthDate: string;
  email: string;
  phone: string | null;
  age: number;
  version: number;
  subscriptions: object[];
}

export function baseMember(overrides: Partial<MemberState> = {}): MemberState {
  return {
    id: MEMBER_ID,
    coachId: null,
    fullName: "Olena Shevchenko",
    birthDate: "1994-05-17",
    email: "olena@example.com",
    phone: "+380501234567",
    age: 32,
    version: 1,
    subscriptions: [
      {
        id: ACTIVE_SUB,
        tariffId: MONTHLY,
        startsOn: addDays(today, -10),
        endsOn: addDays(today, 19),
        priceCents: 4900,
        visitLimit: null,
        cancelledOn: null,
        status: "active",
      },
      {
        id: OLD_SUB,
        tariffId: QUARTERLY,
        startsOn: addDays(today, -130),
        endsOn: addDays(today, -41),
        priceCents: 12900,
        visitLimit: 20,
        cancelledOn: null,
        status: "expired",
      },
    ],
    ...overrides,
  };
}

export const tariffs = [
  {
    id: MONTHLY,
    name: "Monthly",
    priceCents: 4900,
    durationDays: 30,
    visitLimit: null,
    archived: false,
    version: 1,
  },
  {
    id: QUARTERLY,
    name: "Quarterly",
    priceCents: 12900,
    durationDays: 90,
    visitLimit: 20,
    archived: true,
    version: 2,
  },
];
export const coaches = [
  {
    id: IVAN,
    fullName: "Ivan Petrenko",
    specialization: "Strength",
    authSubject: null,
    weeklyHours: [],
    archived: false,
    version: 1,
  },
  {
    id: OLHA,
    fullName: "Olha Koval",
    specialization: "Yoga",
    authSubject: null,
    weeklyHours: [],
    archived: false,
    version: 1,
  },
];

export function visit(index: number) {
  return {
    id: `6f1d7a52-2f0f-4a43-9a53-5d9b1a9b04${String(index).padStart(2, "0")}`,
    subscriptionId: ACTIVE_SUB,
    visitDate: addDays(today, -index),
    checkedInAt: new Date(2026, 9, 21 - index, 9 + (index % 5), 30).toISOString(),
  };
}

export function profileApi(
  state: MemberState,
  options: { visits?: number; overrides?: Parameters<typeof mockApi>[0] } = {},
) {
  const visits = Array.from({ length: options.visits ?? 0 }, (_, index) => visit(index + 1));
  return mockApi({
    "GET /api/members/:id": () => json(state),
    "GET /api/tariffs": ({ query }) =>
      json(tariffs.filter((tariff) => query.get("includeArchived") === "true" || !tariff.archived)),
    "GET /api/coaches": () => json(coaches),
    "GET /api/members/:id/check-ins": ({ query }) => {
      const offset = Number(query.get("offset") ?? 0);
      const limit = Number(query.get("limit") ?? 10);
      return json({ items: visits.slice(offset, offset + limit), total: visits.length });
    },
    "PATCH /api/members/:id": ({ body }) => {
      Object.assign(state, body, { version: state.version + 1, age: 32 });
      return json(state);
    },
    "PUT /api/members/:id/coach": ({ body }) => {
      state.coachId = (body as { coachId: string | null }).coachId;
      state.version += 1;
      return json(state);
    },
    "POST /api/members/:id/subscriptions": ({ body }) => {
      const { tariffId, startsOn } = body as { tariffId: string; startsOn: string };
      const tariff = tariffs.find((item) => item.id === tariffId) ?? tariffs[0];
      state.subscriptions.push({
        id: "6f1d7a52-2f0f-4a43-9a53-5d9b1a9b0777",
        tariffId,
        startsOn,
        endsOn: addDays(startsOn, (tariff?.durationDays ?? 30) - 1),
        priceCents: tariff?.priceCents ?? 0,
        visitLimit: tariff?.visitLimit ?? null,
        cancelledOn: null,
        status: startsOn > today ? "upcoming" : "active",
      });
      state.version += 1;
      return json(state, 201);
    },
    "POST /api/members/:id/subscriptions/:subscriptionId/cancel": ({ params }) => {
      const target = state.subscriptions.find(
        (item) => (item as { id: string }).id === params.subscriptionId,
      );
      Object.assign(target ?? {}, { cancelledOn: today, status: "cancelled" });
      state.version += 1;
      return json(state);
    },
    "POST /api/members/:id/check-ins": () =>
      json(
        {
          id: "6f1d7a52-2f0f-4a43-9a53-5d9b1a9b0999",
          memberId: MEMBER_ID,
          subscriptionId: ACTIVE_SUB,
          visitDate: today,
          checkedInAt: new Date().toISOString(),
        },
        201,
      ),
    ...options.overrides,
  });
}

export async function openProfile(
  api: ReturnType<typeof mockApi>,
  state: MemberState,
  options: RenderOptions = {},
) {
  const user = userEvent.setup();
  const view = renderApp({
    path: `/members/${state.id}`,
    roles: ["reception"],
    fetch: api,
    ...options,
  });
  await screen.findByRole("heading", { name: state.fullName });
  return { user, ...view };
}
