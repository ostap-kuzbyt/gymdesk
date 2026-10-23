import { randomUUID } from "node:crypto";
import { isCalendarDate } from "@gymdesk/shared";
import { ConflictError, DomainError, NotFoundError } from "../../platform/errors.js";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const MIN_MINUTES = 15;
const MAX_MINUTES = 240;

export type WorkoutKind = "group" | "individual";

export interface Moment {
  date: string;
  time: string;
  iso: string;
}

export interface Reservation {
  id: string;
  memberId: string;
  reservedAt: string;
  cancelledAt: string | null;
}

export interface WorkoutSnapshot {
  id: string;
  title: string;
  kind: WorkoutKind;
  studioId: string;
  coachId: string;
  date: string;
  startTime: string;
  endTime: string;
  capacity: number;
  cancelled: boolean;
  version: number;
  reservations: Reservation[];
}

export interface NewWorkout {
  title: string;
  kind: WorkoutKind;
  studioId: string;
  coachId: string;
  date: string;
  startTime: string;
  endTime: string;
  capacity?: number | undefined;
}

function toMinutes(time: string): number {
  const [hours = 0, minutes = 0] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function copyReservations(reservations: Reservation[]): Reservation[] {
  return reservations.map((reservation) => ({ ...reservation }));
}

export class Workout {
  private constructor(private snapshot: WorkoutSnapshot) {}

  static schedule(
    input: NewWorkout,
    studioCapacity: number,
    now: Moment,
    id: string = randomUUID(),
  ): Workout {
    const title = input.title.trim();
    if (title.length < 2 || title.length > 80) {
      throw new DomainError("Workout title must be between 2 and 80 characters");
    }

    if (!isCalendarDate(input.date)) {
      throw new DomainError("Workout date must be a real date as YYYY-MM-DD");
    }
    if (!TIME_PATTERN.test(input.startTime) || !TIME_PATTERN.test(input.endTime)) {
      throw new DomainError("Workout times must use the HH:MM format");
    }
    const minutes = toMinutes(input.endTime) - toMinutes(input.startTime);
    if (minutes < MIN_MINUTES || minutes > MAX_MINUTES) {
      throw new DomainError(
        `A workout must last between ${MIN_MINUTES} and ${MAX_MINUTES} minutes`,
      );
    }
    if (input.date < now.date || (input.date === now.date && input.startTime <= now.time)) {
      throw new DomainError("A workout must be scheduled in the future");
    }

    let capacity: number;
    if (input.kind === "individual") {
      if (input.capacity !== undefined && input.capacity !== 1) {
        throw new DomainError("An individual session has exactly one place");
      }
      capacity = 1;
    } else {
      capacity = input.capacity ?? studioCapacity;
      if (!Number.isInteger(capacity) || capacity < 2) {
        throw new DomainError("A group workout needs a capacity of at least 2");
      }
      if (capacity > studioCapacity) {
        throw new DomainError(`The studio only holds ${studioCapacity} people`);
      }
    }

    return new Workout({
      id,
      title,
      kind: input.kind,
      studioId: input.studioId,
      coachId: input.coachId,
      date: input.date,
      startTime: input.startTime,
      endTime: input.endTime,
      capacity,
      cancelled: false,
      version: 1,
      reservations: [],
    });
  }

  static restore(snapshot: WorkoutSnapshot): Workout {
    return new Workout({ ...snapshot, reservations: copyReservations(snapshot.reservations) });
  }

  get id(): string {
    return this.snapshot.id;
  }

  get version(): number {
    return this.snapshot.version;
  }

  get cancelled(): boolean {
    return this.snapshot.cancelled;
  }

  get spotsLeft(): number {
    return this.snapshot.capacity - this.activeReservations().length;
  }

  toSnapshot(): WorkoutSnapshot {
    return { ...this.snapshot, reservations: copyReservations(this.snapshot.reservations) };
  }

  hasStarted(now: Moment): boolean {
    return (
      this.snapshot.date < now.date ||
      (this.snapshot.date === now.date && this.snapshot.startTime <= now.time)
    );
  }

  hasEnded(now: Moment): boolean {
    return (
      this.snapshot.date < now.date ||
      (this.snapshot.date === now.date && this.snapshot.endTime <= now.time)
    );
  }

  reserve(memberId: string, now: Moment, id: string = randomUUID()): Reservation {
    if (this.snapshot.cancelled) throw new DomainError("The workout has been cancelled");
    if (this.hasStarted(now)) throw new DomainError("The workout has already started");

    const active = this.activeReservations();
    if (active.some((reservation) => reservation.memberId === memberId)) {
      throw new ConflictError("The member is already signed up for this workout");
    }
    if (active.length >= this.snapshot.capacity) {
      throw new ConflictError("The workout is full");
    }

    const reservation: Reservation = { id, memberId, reservedAt: now.iso, cancelledAt: null };
    this.snapshot.reservations.push(reservation);
    return { ...reservation };
  }

  cancelReservation(reservationId: string, now: Moment): void {
    const reservation = this.snapshot.reservations.find((item) => item.id === reservationId);
    if (!reservation) throw new NotFoundError("Reservation was not found");
    if (reservation.cancelledAt !== null) {
      throw new DomainError("The reservation has already been cancelled");
    }
    if (this.hasStarted(now)) {
      throw new DomainError("A reservation cannot be cancelled after the workout has started");
    }
    reservation.cancelledAt = now.iso;
  }

  cancel(now: Moment): void {
    if (this.snapshot.cancelled) throw new DomainError("The workout has already been cancelled");
    if (this.hasEnded(now)) throw new DomainError("The workout has already finished");
    this.snapshot = { ...this.snapshot, cancelled: true };
  }

  private activeReservations(): Reservation[] {
    return this.snapshot.reservations.filter((reservation) => reservation.cancelledAt === null);
  }
}
