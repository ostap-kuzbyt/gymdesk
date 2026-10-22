import type { Db } from "../../platform/db/client.js";
import { withTx } from "../../platform/db/tx.js";
import { ConflictError, DomainError, NotFoundError } from "../../platform/errors.js";
import { Tariff } from "./tariff.js";
import type { NewTariff, TariffChanges, TariffSnapshot } from "./tariff.js";
import { tariffRepo } from "./tariff.repo.js";

export interface TariffQuote {
  tariffId: string;
  startsOn: string;
  endsOn: string;
  priceCents: number;
  visitLimit: number | null;
}

export class TariffService {
  constructor(private readonly db: Db) {}

  async list(options: { includeArchived: boolean }): Promise<TariffSnapshot[]> {
    const tariffs = await tariffRepo.list(this.db, options);
    return tariffs.map((tariff) => tariff.toSnapshot());
  }

  async get(id: string): Promise<TariffSnapshot> {
    const tariff = await tariffRepo.findById(this.db, id);
    if (!tariff) throw new NotFoundError("Tariff was not found");
    return tariff.toSnapshot();
  }

  async quote(id: string, startsOn: string): Promise<TariffQuote> {
    const tariff = await tariffRepo.findById(this.db, id);
    if (!tariff) throw new NotFoundError("Tariff was not found");
    if (tariff.archived) throw new DomainError("An archived tariff can no longer be sold");

    const { priceCents, visitLimit } = tariff.toSnapshot();
    return { tariffId: id, startsOn, endsOn: tariff.endDateFor(startsOn), priceCents, visitLimit };
  }

  create(input: NewTariff): Promise<TariffSnapshot> {
    const tariff = Tariff.create(input);
    return withTx(this.db, async (tx) => {
      await tariffRepo.insert(tx, tariff);
      return tariff.toSnapshot();
    });
  }

  update(id: string, expectedVersion: number, changes: TariffChanges): Promise<TariffSnapshot> {
    return this.modify(id, (tariff) => {
      if (tariff.version !== expectedVersion) {
        throw new ConflictError("The tariff was changed by someone else, reload and try again");
      }
      tariff.change(changes);
    });
  }

  archive(id: string): Promise<TariffSnapshot> {
    return this.modify(id, (tariff) => tariff.archive());
  }

  private modify(id: string, apply: (tariff: Tariff) => void): Promise<TariffSnapshot> {
    return withTx(this.db, async (tx) => {
      const tariff = await tariffRepo.findById(tx, id);
      if (!tariff) throw new NotFoundError("Tariff was not found");

      apply(tariff);
      await tariffRepo.save(tx, tariff);

      const saved = await tariffRepo.findById(tx, id);
      return (saved ?? tariff).toSnapshot();
    });
  }
}
