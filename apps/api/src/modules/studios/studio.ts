import { randomUUID } from "node:crypto";
import { DomainError } from "../../platform/errors.js";

const MAX_CAPACITY = 500;

export interface StudioSnapshot {
  id: string;
  name: string;
  capacity: number;
  archived: boolean;
  version: number;
}

export interface NewStudio {
  name: string;
  capacity: number;
}

export interface StudioChanges {
  name?: string | undefined;
  capacity?: number | undefined;
}

function validateTerms(terms: NewStudio): NewStudio {
  const name = terms.name.trim();
  if (name.length < 2 || name.length > 60) {
    throw new DomainError("Studio name must be between 2 and 60 characters");
  }
  if (!Number.isInteger(terms.capacity) || terms.capacity < 1 || terms.capacity > MAX_CAPACITY) {
    throw new DomainError(`Studio capacity must be between 1 and ${MAX_CAPACITY} people`);
  }
  return { name, capacity: terms.capacity };
}

export class Studio {
  private constructor(private snapshot: StudioSnapshot) {}

  static create(input: NewStudio, id: string = randomUUID()): Studio {
    return new Studio({ id, ...validateTerms(input), archived: false, version: 1 });
  }

  static restore(snapshot: StudioSnapshot): Studio {
    return new Studio({ ...snapshot });
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

  toSnapshot(): StudioSnapshot {
    return { ...this.snapshot };
  }

  change(changes: StudioChanges): void {
    this.assertActive();
    const terms = validateTerms({
      name: changes.name ?? this.snapshot.name,
      capacity: changes.capacity ?? this.snapshot.capacity,
    });
    this.snapshot = { ...this.snapshot, ...terms };
  }

  archive(): void {
    this.assertActive();
    this.snapshot = { ...this.snapshot, archived: true };
  }

  private assertActive(): void {
    if (this.snapshot.archived) {
      throw new DomainError("An archived studio can no longer be changed");
    }
  }
}
