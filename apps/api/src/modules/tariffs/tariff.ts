import { randomUUID } from "node:crypto";
import { DomainError } from "../../platform/errors.js";

const MS_PER_DAY = 86_400_000;
const MAX_DURATION_DAYS = 732;

export interface TariffSnapshot {
  id: string;
  name: string;
  priceCents: number;
  durationDays: number;
  visitLimit: number | null;
  archived: boolean;
  version: number;
}

export interface NewTariff {
  name: string;
  priceCents: number;
  durationDays: number;
  visitLimit?: number | null;
}

export type TariffChanges = Partial<NewTariff>;

type TariffTerms = Pick<TariffSnapshot, "name" | "priceCents" | "durationDays" | "visitLimit">;

function validateTerms(terms: TariffTerms): TariffTerms {
  const name = terms.name.trim();
  if (name.length < 2 || name.length > 80) {
    throw new DomainError("Tariff name must be between 2 and 80 characters");
  }
  if (!Number.isInteger(terms.priceCents) || terms.priceCents < 0) {
    throw new DomainError("Tariff price must be a non-negative number of cents");
  }
  if (
    !Number.isInteger(terms.durationDays) ||
    terms.durationDays < 1 ||
    terms.durationDays > MAX_DURATION_DAYS
  ) {
    throw new DomainError(`Tariff duration must be between 1 and ${MAX_DURATION_DAYS} days`);
  }
  if (terms.visitLimit !== null && (!Number.isInteger(terms.visitLimit) || terms.visitLimit < 1)) {
    throw new DomainError("Visit limit must be at least 1, or empty for unlimited visits");
  }
  return { ...terms, name };
}

export class Tariff {
  private constructor(private snapshot: TariffSnapshot) {}

  static create(input: NewTariff, id: string = randomUUID()): Tariff {
    const terms = validateTerms({ ...input, visitLimit: input.visitLimit ?? null });
    return new Tariff({ id, ...terms, archived: false, version: 1 });
  }

  static restore(snapshot: TariffSnapshot): Tariff {
    return new Tariff({ ...snapshot });
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

  toSnapshot(): TariffSnapshot {
    return { ...this.snapshot };
  }

  change(changes: TariffChanges): void {
    this.assertActive();
    const { visitLimit, ...rest } = changes;
    const terms = validateTerms({
      ...this.snapshot,
      ...rest,
      visitLimit: visitLimit === undefined ? this.snapshot.visitLimit : visitLimit,
    });
    this.snapshot = { ...this.snapshot, ...terms };
  }

  archive(): void {
    this.assertActive();
    this.snapshot = { ...this.snapshot, archived: true };
  }

  endDateFor(startsOn: string): string {
    const start = new Date(`${startsOn}T00:00:00Z`);
    if (Number.isNaN(start.getTime()) || start.toISOString().slice(0, 10) !== startsOn) {
      throw new DomainError(`${startsOn} is not a valid date`);
    }
    const end = new Date(start.getTime() + (this.snapshot.durationDays - 1) * MS_PER_DAY);
    return end.toISOString().slice(0, 10);
  }

  private assertActive(): void {
    if (this.snapshot.archived) {
      throw new DomainError("An archived tariff can no longer be changed");
    }
  }
}
