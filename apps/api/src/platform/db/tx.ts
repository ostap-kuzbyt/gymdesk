import { ConflictError } from "../errors.js";
import type { Db } from "./client.js";

export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type Executor = Db | Tx;

const UNIQUE_VIOLATION = "23505";

export function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && typeof current === "object" && current !== null; depth++) {
    if ("code" in current && current.code === UNIQUE_VIOLATION) return true;
    current = "cause" in current ? current.cause : undefined;
  }
  return false;
}

export async function withTx<T>(db: Db, work: (tx: Tx) => Promise<T>): Promise<T> {
  try {
    return await db.transaction(work);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError("The record conflicts with an existing one");
    }
    throw error;
  }
}
