import { addDays } from "@/lib/dates";
import { todayLocal } from "@/lib/format";
import { mondayOf } from "@/lib/week";

export const today = todayLocal();
export const monday = mondayOf(today);

const id = (group: number, index: number) =>
  `6f1d7a52-2f0f-4a43-9a53-${String(group).padStart(4, "0")}${String(index).padStart(8, "0")}`;

export const ids = {
  tariffMonthly: id(1, 1),
  tariffTen: id(1, 2),
  tariffQuarterly: id(1, 3),
  studioMain: id(2, 1),
  studioYoga: id(2, 2),
  coachIvan: id(3, 1),
  coachOlha: id(3, 2),
  memberOlena: id(4, 1),
  memberAndriy: id(4, 2),
  memberTaras: id(4, 3),
  subscriptionOlena: id(5, 1),
  subscriptionAndriy: id(5, 2),
  workoutToday: id(6, 1),
  workoutTomorrow: id(6, 2),
  reminderSent: id(7, 1),
  reminderFailed: id(7, 2),
  reminderPromo: id(7, 3),
};

const everyWeekday = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
  weekday,
  from: "07:00",
  to: "22:00",
}));

export const tariffs = [
  {
    id: ids.tariffMonthly,
    name: "Monthly",
    priceCents: 4900,
    durationDays: 30,
    visitLimit: null,
    archived: false,
    version: 1,
  },
  {
    id: ids.tariffTen,
    name: "Ten visits",
    priceCents: 3500,
    durationDays: 60,
    visitLimit: 10,
    archived: false,
    version: 1,
  },
  {
    id: ids.tariffQuarterly,
    name: "Quarterly",
    priceCents: 12900,
    durationDays: 90,
    visitLimit: null,
    archived: true,
    version: 2,
  },
];

export const studios = [
  { id: ids.studioMain, name: "Main hall", capacity: 30, archived: false, version: 1 },
  { id: ids.studioYoga, name: "Yoga room", capacity: 14, archived: false, version: 1 },
];

export const coaches = [
  {
    id: ids.coachIvan,
    fullName: "Ivan Petrenko",
    specialization: "Strength training",
    authSubject: null,
    weeklyHours: everyWeekday,
    archived: false,
    version: 1,
  },
  {
    id: ids.coachOlha,
    fullName: "Olha Koval",
    specialization: "Yoga and stretching",
    authSubject: null,
    weeklyHours: [{ weekday: 1, from: "09:00", to: "15:00" }],
    archived: false,
    version: 1,
  },
];

export const members = [
  {
    id: ids.memberOlena,
    coachId: ids.coachIvan,
    fullName: "Olena Shevchenko",
    birthDate: "1994-05-17",
    email: "olena@example.com",
    phone: "+380501234567",
    age: 32,
    version: 2,
    subscriptions: [
      {
        id: ids.subscriptionOlena,
        tariffId: ids.tariffMonthly,
        startsOn: addDays(today, -10),
        endsOn: addDays(today, 19),
        priceCents: 4900,
        visitLimit: null,
        cancelledOn: null,
        status: "active" as const,
      },
    ],
  },
  {
    id: ids.memberAndriy,
    coachId: null,
    fullName: "Andriy Bondar",
    birthDate: "1988-11-02",
    email: "andriy@example.com",
    phone: null,
    age: 37,
    version: 1,
    subscriptions: [
      {
        id: ids.subscriptionAndriy,
        tariffId: ids.tariffTen,
        startsOn: addDays(today, -27),
        endsOn: addDays(today, 3),
        priceCents: 3500,
        visitLimit: 10,
        cancelledOn: null,
        status: "active" as const,
      },
    ],
  },
  {
    id: ids.memberTaras,
    coachId: null,
    fullName: "Taras Melnyk",
    birthDate: "2001-02-20",
    email: "taras@example.com",
    phone: null,
    age: 25,
    version: 1,
    subscriptions: [],
  },
];

export function memberListItem(member: (typeof members)[number]) {
  const running = member.subscriptions.find((subscription) => subscription.status === "active");
  return {
    id: member.id,
    fullName: member.fullName,
    age: member.age,
    email: member.email,
    phone: member.phone,
    activeUntil: running?.endsOn ?? null,
  };
}

export const workouts = [
  {
    id: ids.workoutToday,
    title: "Functional training",
    kind: "group" as const,
    studioId: ids.studioMain,
    coachId: ids.coachIvan,
    date: today,
    startTime: "23:00",
    endTime: "23:59",
    capacity: 20,
    reserved: 2,
    cancelled: false,
  },
  {
    id: ids.workoutTomorrow,
    title: "Hatha yoga",
    kind: "group" as const,
    studioId: ids.studioYoga,
    coachId: ids.coachOlha,
    date: addDays(today, 1),
    startTime: "10:00",
    endTime: "11:00",
    capacity: 14,
    reserved: 0,
    cancelled: false,
  },
];

export function workoutView(workout: (typeof workouts)[number]) {
  const booked = [
    { memberId: ids.memberOlena, memberName: "Olena Shevchenko" },
    { memberId: ids.memberAndriy, memberName: "Andriy Bondar" },
  ].slice(0, workout.reserved);
  return {
    ...workout,
    spotsLeft: workout.capacity - workout.reserved,
    version: 2,
    reservations: booked.map((entry, index) => ({
      id: id(8, index + 1),
      memberId: entry.memberId,
      memberName: entry.memberName,
      reservedAt: new Date().toISOString(),
      cancelledAt: null,
    })),
  };
}

export const reminders = [
  {
    id: ids.reminderSent,
    memberId: ids.memberOlena,
    memberName: "Olena Shevchenko",
    subscriptionId: ids.subscriptionOlena,
    kind: "expiry" as const,
    trigger: "scan" as const,
    email: "olena@example.com",
    status: "sent" as const,
    attempts: 1,
    error: null,
    createdAt: new Date().toISOString(),
    sentAt: new Date().toISOString(),
  },
  {
    id: ids.reminderFailed,
    memberId: ids.memberAndriy,
    memberName: "Andriy Bondar",
    subscriptionId: ids.subscriptionAndriy,
    kind: "expiry" as const,
    trigger: "scan" as const,
    email: "andriy@example.com",
    status: "failed" as const,
    attempts: 2,
    error: "Mailbox is full",
    createdAt: new Date().toISOString(),
    sentAt: null,
  },
  {
    id: ids.reminderPromo,
    memberId: ids.memberTaras,
    memberName: "Taras Melnyk",
    subscriptionId: null,
    kind: "promo" as const,
    trigger: "manual" as const,
    email: "taras@example.com",
    status: "sent" as const,
    attempts: 1,
    error: null,
    createdAt: new Date().toISOString(),
    sentAt: new Date().toISOString(),
  },
];

export const visits = [
  {
    id: id(9, 1),
    subscriptionId: ids.subscriptionOlena,
    visitDate: addDays(today, -1),
    checkedInAt: new Date(Date.now() - 86_400_000).toISOString(),
  },
];

export function attendance(from: string, to: string) {
  return {
    from,
    to,
    total: members.length,
    items: members.map((member, index) => ({
      memberId: member.id,
      fullName: member.fullName,
      email: member.email,
      visits: index === 0 ? 4 : index === 1 ? 1 : 0,
      lastVisitOn: index < 2 ? addDays(today, -1) : null,
      activeUntil: memberListItem(member).activeUntil,
    })),
  };
}

export function revenue(granularity: "month" | "year") {
  return {
    granularity,
    rows:
      granularity === "year"
        ? [{ period: today.slice(0, 4), revenueCents: 8400, subscriptions: 2 }]
        : [{ period: today.slice(0, 7), revenueCents: 8400, subscriptions: 2 }],
    totalCents: 8400,
    totalSubscriptions: 2,
  };
}

export function load(from: string, to: string) {
  return {
    from,
    to,
    coaches: [
      {
        date: today,
        id: ids.coachIvan,
        name: "Ivan Petrenko",
        workouts: 1,
        minutes: 60,
        reserved: 2,
        capacity: 20,
      },
    ],
    studios: [
      {
        date: today,
        id: ids.studioMain,
        name: "Main hall",
        workouts: 1,
        minutes: 60,
        reserved: 2,
        capacity: 20,
      },
    ],
  };
}
