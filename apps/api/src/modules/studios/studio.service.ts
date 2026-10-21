import type { Db } from "../../platform/db/client.js";
import { withTx } from "../../platform/db/tx.js";
import { ConflictError, NotFoundError } from "../../platform/errors.js";
import { Studio } from "./studio.js";
import type { NewStudio, StudioChanges, StudioSnapshot } from "./studio.js";
import { studioRepo } from "./studio.repo.js";

export class StudioService {
  constructor(private readonly db: Db) {}

  async list(options: { includeArchived: boolean }): Promise<StudioSnapshot[]> {
    const studios = await studioRepo.list(this.db, options);
    return studios.map((studio) => studio.toSnapshot());
  }

  async get(id: string): Promise<StudioSnapshot> {
    const studio = await studioRepo.findById(this.db, id);
    if (!studio) throw new NotFoundError("Studio was not found");
    return studio.toSnapshot();
  }

  create(input: NewStudio): Promise<StudioSnapshot> {
    const studio = Studio.create(input);
    return withTx(this.db, async (tx) => {
      await studioRepo.insert(tx, studio);
      return studio.toSnapshot();
    });
  }

  update(id: string, expectedVersion: number, changes: StudioChanges): Promise<StudioSnapshot> {
    return this.modify(id, (studio) => {
      if (studio.version !== expectedVersion) {
        throw new ConflictError("The studio was changed by someone else, reload and try again");
      }
      studio.change(changes);
    });
  }

  archive(id: string): Promise<StudioSnapshot> {
    return this.modify(id, (studio) => studio.archive());
  }

  private modify(id: string, apply: (studio: Studio) => void): Promise<StudioSnapshot> {
    return withTx(this.db, async (tx) => {
      const studio = await studioRepo.findById(tx, id);
      if (!studio) throw new NotFoundError("Studio was not found");

      apply(studio);
      await studioRepo.save(tx, studio);

      const saved = await studioRepo.findById(tx, id);
      return (saved ?? studio).toSnapshot();
    });
  }
}
