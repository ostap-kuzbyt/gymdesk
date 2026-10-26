import { sql } from "drizzle-orm";
import { addDays } from "./platform/dates.js";
import { createClock } from "./platform/clock.js";
import type { Db } from "./platform/db/client.js";
import { ConflictError, DomainError } from "./platform/errors.js";
import { createServices } from "./services.js";
import type { Services } from "./services.js";

export interface DemoOptions {
  today: string;
  days: number;
  members: number;
  seed: number;
  timeZone: string;
}

export interface DemoSummary {
  tariffs: number;
  studios: number;
  coaches: number;
  members: number;
  subscriptions: number;
  checkIns: number;
  workouts: number;
  reservations: number;
  reminders: number;
}

const FIRST_NAMES = [
  "Andriy",
  "Bohdan",
  "Taras",
  "Oleh",
  "Maksym",
  "Yurii",
  "Denys",
  "Ihor",
  "Roman",
  "Vitalii",
  "Olena",
  "Iryna",
  "Nataliia",
  "Kateryna",
  "Oksana",
  "Mariia",
  "Svitlana",
  "Tetiana",
  "Yulia",
  "Daryna",
];
const LAST_NAMES = [
  "Shevchenko",
  "Kovalenko",
  "Bondarenko",
  "Tkachenko",
  "Kravchenko",
  "Melnyk",
  "Boyko",
  "Savchenko",
  "Polishchuk",
  "Lysenko",
  "Marchenko",
  "Rudenko",
  "Moroz",
  "Honchar",
  "Petrenko",
  "Kovalchuk",
];

const COACH_PROFILES = [
  {
    fullName: "Ivan Petrenko",
    specialization: "Strength training",
    days: [1, 2, 3, 4, 5],
    from: "07:00",
    to: "13:00",
  },
  {
    fullName: "Olha Koval",
    specialization: "Yoga and stretching",
    days: [1, 3, 5, 6],
    from: "09:00",
    to: "15:00",
  },
  {
    fullName: "Dmytro Lysyi",
    specialization: "Cycling",
    days: [2, 4, 6, 7],
    from: "16:00",
    to: "21:00",
  },
  {
    fullName: "Sofiia Marchuk",
    specialization: "Boxing",
    days: [1, 2, 3, 4, 5],
    from: "16:00",
    to: "21:00",
  },
  {
    fullName: "Pavlo Hrytsenko",
    specialization: "Functional training",
    days: [1, 2, 3, 4, 5, 6, 7],
    from: "10:00",
    to: "20:00",
  },
];

const STUDIO_PROFILES = [
  { name: "Main hall", capacity: 30, title: "Functional training" },
  { name: "Cycling studio", capacity: 18, title: "Spinning" },
  { name: "Yoga room", capacity: 14, title: "Hatha yoga" },
  { name: "Boxing ring", capacity: 10, title: "Boxing basics" },
];

const TARIFF_PROFILES = [
  { name: "Single visit", priceCents: 1000, durationDays: 1, visitLimit: 1, weight: 12 },
  { name: "Monthly", priceCents: 4900, durationDays: 30, visitLimit: null, weight: 40 },
  { name: "Monthly, 12 visits", priceCents: 3500, durationDays: 30, visitLimit: 12, weight: 25 },
  { name: "Quarterly", priceCents: 12900, durationDays: 90, visitLimit: null, weight: 15 },
  { name: "Yearly", priceCents: 44900, durationDays: 365, visitLimit: null, weight: 8 },
];

const SLOTS = ["07:30", "09:00", "10:30", "12:00", "16:30", "18:00", "19:30"];

function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function weekdayOf(date: string): number {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

function addMinutes(time: string, minutes: number): string {
  const [hours = 0, mins = 0] = time.split(":").map(Number);
  const total = hours * 60 + mins + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

interface Tracked {
  id: string;
  habit: number;
  coachId: string | null;
  subscriptionEndsOn: string | null;
}

export async function seedDemoData(db: Db, options: DemoOptions): Promise<DemoSummary> {
  const [existing] = await db
    .execute<{ total: number }>(sql`select count(*)::int as total from tariffs`)
    .then((result) => result.rows);
  if (existing && existing.total > 0) {
    throw new Error("The database already has data. Run the seed with --reset to replace it.");
  }

  const random = createRandom(options.seed);
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)] as T;

  const start = addDays(options.today, -options.days);
  let current = new Date(`${start}T09:00:00Z`);
  const clock = createClock(options.timeZone, () => current);
  const services: Services = createServices({
    db,
    clock,
    mailer: { send: async () => undefined },
    reminders: { clubName: "Gymdesk", daysBefore: 7, discountPercent: 10 },
  });
  const goTo = (day: string) => {
    current = new Date(`${day}T09:00:00Z`);
  };

  const tariffs: ((typeof TARIFF_PROFILES)[number] & { id: string })[] = [];
  for (const profile of TARIFF_PROFILES) {
    const created = await services.tariffs.create(profile);
    tariffs.push({ ...profile, id: created.id });
  }
  const studios: ((typeof STUDIO_PROFILES)[number] & { id: string })[] = [];
  for (const profile of STUDIO_PROFILES) {
    const created = await services.studios.create({
      name: profile.name,
      capacity: profile.capacity,
    });
    studios.push({ ...profile, id: created.id });
  }
  const coaches: ((typeof COACH_PROFILES)[number] & { id: string })[] = [];
  for (const profile of COACH_PROFILES) {
    const created = await services.coaches.create({
      fullName: profile.fullName,
      specialization: profile.specialization,
      weeklyHours: profile.days.map((weekday) => ({ weekday, from: profile.from, to: profile.to })),
    });
    coaches.push({ ...profile, id: created.id });
  }

  const roster: Tracked[] = [];
  let registered = 0;
  const registerNext = async () => {
    const index = registered;
    registered += 1;
    const first = FIRST_NAMES[index % FIRST_NAMES.length] as string;
    const last = LAST_NAMES[Math.floor(index / FIRST_NAMES.length) % LAST_NAMES.length] as string;
    const member = await services.members.register({
      fullName: `${first} ${last}`,
      birthDate: `${1972 + Math.floor(random() * 33)}-${String(1 + Math.floor(random() * 12)).padStart(2, "0")}-${String(1 + Math.floor(random() * 28)).padStart(2, "0")}`,
      email: `${first}.${last}.${index + 1}@example.com`.toLowerCase(),
      phone: random() < 0.8 ? `+38050${String(1000000 + index * 7919).slice(-7)}` : undefined,
    });
    let coachId: string | null = null;
    if (random() < 0.6) {
      coachId = pick(coaches).id;
      await services.members.assignCoach(member.id, coachId);
    }
    roster.push({ id: member.id, habit: 0.15 + random() * 0.6, coachId, subscriptionEndsOn: null });
  };

  const scheduleDay = async (date: string, attempts: number) => {
    for (let attempt = 0; attempt < attempts; attempt++) {
      const studio = pick(studios);
      const slot = pick(SLOTS);
      const end = addMinutes(slot, 60);
      const coach = pick(coaches);
      const individual = random() < 0.15;
      try {
        await services.workouts.schedule({
          title: individual
            ? `Personal training with ${coach.fullName.split(" ")[0]}`
            : studio.title,
          kind: individual ? "individual" : "group",
          studioId: studio.id,
          coachId: coach.id,
          date,
          startTime: slot,
          endTime: end,
          capacity: individual
            ? undefined
            : Math.max(4, Math.round(studio.capacity * (0.5 + random() * 0.5))),
        });
      } catch (error) {
        if (!(error instanceof DomainError || error instanceof ConflictError)) throw error;
      }
    }
  };

  const initialMembers = Math.ceil(options.members * 0.6);
  for (let index = 0; index < initialMembers; index++) await registerNext();
  for (let offset = 1; offset <= 3; offset++) await scheduleDay(addDays(start, offset), 6);

  for (let offset = 0; offset <= options.days; offset++) {
    const day = addDays(start, offset);
    goTo(day);

    if (
      registered < options.members &&
      random() < (options.members - initialMembers) / options.days
    ) {
      await registerNext();
    }

    for (const member of roster) {
      const hasPlan = member.subscriptionEndsOn !== null && member.subscriptionEndsOn >= day;
      if (!hasPlan && random() < 0.4) {
        let roll = random() * TARIFF_PROFILES.reduce((sum, item) => sum + item.weight, 0);
        const tariff = tariffs.find((item) => (roll -= item.weight) < 0) ?? tariffs[1]!;
        const details = await services.members.purchaseSubscription(member.id, {
          tariffId: tariff.id,
        });
        member.subscriptionEndsOn = details.subscriptions.at(-1)?.endsOn ?? null;
      }

      const attends = member.subscriptionEndsOn !== null && member.subscriptionEndsOn >= day;
      const weekendFactor = weekdayOf(day) >= 6 ? 0.6 : 1;
      if (attends && random() < member.habit * weekendFactor) {
        try {
          await services.members.checkIn(member.id);
        } catch (error) {
          if (!(error instanceof DomainError || error instanceof ConflictError)) throw error;
        }
      }
    }

    await scheduleDay(addDays(day, 3), 6);

    const upcoming = await services.workouts.list({
      from: addDays(day, 1),
      to: addDays(day, 3),
      includeCancelled: false,
    });
    upcoming.sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.startTime.localeCompare(b.startTime) ||
        a.title.localeCompare(b.title),
    );
    for (const workout of upcoming) {
      const interested = Math.floor(random() * Math.min(5, workout.capacity));
      for (let index = 0; index < interested; index++) {
        const member = pick(roster);
        if (member.subscriptionEndsOn === null || member.subscriptionEndsOn < workout.date)
          continue;
        try {
          await services.workouts.reserve(workout.id, member.id);
        } catch (error) {
          if (!(error instanceof DomainError || error instanceof ConflictError)) throw error;
        }
      }
    }

    await services.reminders.scanExpiring();
  }

  goTo(options.today);
  for (let offset = 4; offset <= 7; offset++) await scheduleDay(addDays(options.today, offset), 8);
  while (registered < options.members) await registerNext();

  return countRows(db);
}

async function countRows(db: Db): Promise<DemoSummary> {
  const result = await db.execute<Record<keyof DemoSummary, number>>(sql`
    select
      (select count(*) from tariffs)::int as tariffs,
      (select count(*) from studios)::int as studios,
      (select count(*) from coaches)::int as coaches,
      (select count(*) from members)::int as members,
      (select count(*) from subscriptions)::int as subscriptions,
      (select count(*) from check_ins)::int as "checkIns",
      (select count(*) from workouts)::int as workouts,
      (select count(*) from reservations)::int as reservations,
      (select count(*) from reminders)::int as reminders
  `);
  return result.rows[0] as DemoSummary;
}

export async function clearDemoData(db: Db): Promise<void> {
  await db.execute(sql`
    truncate table reminders, reservations, workouts, check_ins, subscriptions,
      members, coaches, studios, tariffs restart identity cascade
  `);
}
