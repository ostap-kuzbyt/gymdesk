import { randomUUID } from "node:crypto";
import { isCalendarDate } from "@gymdesk/shared";
import { DomainError } from "../../platform/errors.js";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_WINDOWS = 21;

export interface WorkingHours {
  weekday: number;
  from: string;
  to: string;
}

export interface CoachSnapshot {
  id: string;
  fullName: string;
  specialization: string;
  weeklyHours: WorkingHours[];
  archived: boolean;
  version: number;
}

export interface NewCoach {
  fullName: string;
  specialization: string;
  weeklyHours?: WorkingHours[] | undefined;
}

export interface CoachChanges {
  fullName?: string | undefined;
  specialization?: string | undefined;
  weeklyHours?: WorkingHours[] | undefined;
}

type CoachTerms = Pick<CoachSnapshot, "fullName" | "specialization" | "weeklyHours">;

export function isoWeekday(date: string): number {
  if (!isCalendarDate(date)) throw new DomainError(`${date} is not a valid date`);
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

function normaliseHours(hours: WorkingHours[]): WorkingHours[] {
  if (hours.length > MAX_WINDOWS) {
    throw new DomainError(`A coach can have at most ${MAX_WINDOWS} working windows per week`);
  }
  for (const window of hours) {
    if (!Number.isInteger(window.weekday) || window.weekday < 1 || window.weekday > 7) {
      throw new DomainError("Weekday must be a number from 1 (Monday) to 7 (Sunday)");
    }
    if (!TIME_PATTERN.test(window.from) || !TIME_PATTERN.test(window.to)) {
      throw new DomainError("Working hours must use the HH:MM format");
    }
    if (window.from >= window.to) {
      throw new DomainError("A working window must end after it starts");
    }
  }

  const sorted = hours
    .map((window) => ({ ...window }))
    .sort((a, b) => a.weekday - b.weekday || a.from.localeCompare(b.from));
  for (let index = 1; index < sorted.length; index++) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    if (previous && current && previous.weekday === current.weekday && current.from < previous.to) {
      throw new DomainError("Working windows on the same weekday must not overlap");
    }
  }
  return sorted;
}

function validateTerms(terms: CoachTerms): CoachTerms {
  const fullName = terms.fullName.trim().replace(/\s+/g, " ");
  if (fullName.length < 2 || fullName.length > 120) {
    throw new DomainError("Full name must be between 2 and 120 characters");
  }
  const specialization = terms.specialization.trim();
  if (specialization.length < 2 || specialization.length > 80) {
    throw new DomainError("Specialization must be between 2 and 80 characters");
  }
  return { fullName, specialization, weeklyHours: normaliseHours(terms.weeklyHours) };
}

export class Coach {
  private constructor(private snapshot: CoachSnapshot) {}

  static create(input: NewCoach, id: string = randomUUID()): Coach {
    const terms = validateTerms({ ...input, weeklyHours: input.weeklyHours ?? [] });
    return new Coach({ id, ...terms, archived: false, version: 1 });
  }

  static restore(snapshot: CoachSnapshot): Coach {
    return new Coach({
      ...snapshot,
      weeklyHours: snapshot.weeklyHours.map((hours) => ({ ...hours })),
    });
  }

  get id(): string {
    return this.snapshot.id;
  }

  get version(): number {
    return this.snapshot.version;
  }

  get archived(): boolean {
    return this.snapshot.archived;
  }

  toSnapshot(): CoachSnapshot {
    return {
      ...this.snapshot,
      weeklyHours: this.snapshot.weeklyHours.map((hours) => ({ ...hours })),
    };
  }

  change(changes: CoachChanges): void {
    this.assertActive();
    const terms = validateTerms({
      fullName: changes.fullName ?? this.snapshot.fullName,
      specialization: changes.specialization ?? this.snapshot.specialization,
      weeklyHours: changes.weeklyHours ?? this.snapshot.weeklyHours,
    });
    this.snapshot = { ...this.snapshot, ...terms };
  }

  archive(): void {
    this.assertActive();
    this.snapshot = { ...this.snapshot, archived: true };
  }

  worksAt(date: string, startTime: string, endTime: string): boolean {
    const weekday = isoWeekday(date);
    return this.snapshot.weeklyHours.some(
      (window) => window.weekday === weekday && window.from <= startTime && endTime <= window.to,
    );
  }

  private assertActive(): void {
    if (this.snapshot.archived) {
      throw new DomainError("An archived coach can no longer be changed");
    }
  }
}
