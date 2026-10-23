import type { Db } from "../../platform/db/client.js";
import { withTx } from "../../platform/db/tx.js";
import { ConflictError, DomainError, NotFoundError } from "../../platform/errors.js";
import { Coach } from "./coach.js";
import type { CoachChanges, CoachSnapshot, NewCoach } from "./coach.js";
import { coachRepo } from "./coach.repo.js";

export class CoachService {
  constructor(private readonly db: Db) {}

  async list(options: { includeArchived: boolean }): Promise<CoachSnapshot[]> {
    const coaches = await coachRepo.list(this.db, options);
    return coaches.map((coach) => coach.toSnapshot());
  }

  async get(id: string): Promise<CoachSnapshot> {
    const coach = await coachRepo.findById(this.db, id);
    if (!coach) throw new NotFoundError("Coach was not found");
    return coach.toSnapshot();
  }

  async requireActive(id: string): Promise<void> {
    const coach = await this.get(id);
    if (coach.archived) throw new DomainError("The coach has been archived");
  }

  async requireAvailable(id: string, date: string, startTime: string, endTime: string) {
    const coach = await coachRepo.findById(this.db, id);
    if (!coach) throw new NotFoundError("Coach was not found");
    if (coach.archived) throw new DomainError("The coach has been archived");
    if (!coach.worksAt(date, startTime, endTime)) {
      throw new DomainError(`The coach does not work on ${date} from ${startTime} to ${endTime}`);
    }
  }

  create(input: NewCoach): Promise<CoachSnapshot> {
    const coach = Coach.create(input);
    return withTx(this.db, async (tx) => {
      await coachRepo.insert(tx, coach);
      return coach.toSnapshot();
    });
  }

  update(id: string, expectedVersion: number, changes: CoachChanges): Promise<CoachSnapshot> {
    return this.modify(id, (coach) => {
      if (coach.version !== expectedVersion) {
        throw new ConflictError("The coach was changed by someone else, reload and try again");
      }
      coach.change(changes);
    });
  }

  archive(id: string): Promise<CoachSnapshot> {
    return this.modify(id, (coach) => coach.archive());
  }

  private modify(id: string, apply: (coach: Coach) => void): Promise<CoachSnapshot> {
    return withTx(this.db, async (tx) => {
      const coach = await coachRepo.findById(tx, id);
      if (!coach) throw new NotFoundError("Coach was not found");

      apply(coach);
      await coachRepo.save(tx, coach);

      const saved = await coachRepo.findById(tx, id);
      return (saved ?? coach).toSnapshot();
    });
  }
}
