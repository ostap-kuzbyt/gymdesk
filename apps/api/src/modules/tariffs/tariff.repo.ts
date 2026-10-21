import { asc, and, eq } from "drizzle-orm";
import { tariffs } from "../../platform/db/schema.js";
import type { Executor } from "../../platform/db/tx.js";
import { ConflictError } from "../../platform/errors.js";
import { Tariff } from "./tariff.js";

type TariffRow = typeof tariffs.$inferSelect;

function toEntity(row: TariffRow): Tariff {
  return Tariff.restore({
    id: row.id,
    name: row.name,
    priceCents: row.priceCents,
    durationDays: row.durationDays,
    visitLimit: row.visitLimit,
    archived: row.archived,
    version: row.version,
  });
}

export const tariffRepo = {
  async findById(db: Executor, id: string): Promise<Tariff | undefined> {
    const [row] = await db.select().from(tariffs).where(eq(tariffs.id, id));
    return row && toEntity(row);
  },

  async list(db: Executor, options: { includeArchived: boolean }): Promise<Tariff[]> {
    const rows = await db
      .select()
      .from(tariffs)
      .where(options.includeArchived ? undefined : eq(tariffs.archived, false))
      .orderBy(asc(tariffs.priceCents), asc(tariffs.name));
    return rows.map(toEntity);
  },

  async insert(db: Executor, tariff: Tariff): Promise<void> {
    await db.insert(tariffs).values(tariff.toSnapshot());
  },

  async save(db: Executor, tariff: Tariff): Promise<void> {
    const { id, version, ...columns } = tariff.toSnapshot();
    const updated = await db
      .update(tariffs)
      .set({ ...columns, version: version + 1 })
      .where(and(eq(tariffs.id, id), eq(tariffs.version, version)))
      .returning({ id: tariffs.id });

    if (updated.length === 0) {
      throw new ConflictError("The tariff was changed by someone else, reload and try again");
    }
  },
};
