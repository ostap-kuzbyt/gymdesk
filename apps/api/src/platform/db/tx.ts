import { ConflictError } from "../errors.js";
import type { Db } from "./client.js";

export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type Executor = Db | Tx;

const CONFLICT_CODES = new Set(["23505", "23P01"]);

export function isConflictViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && typeof current === "object" && current !== null; depth++) {
    if ("code" in current && typeof current.code === "string" && CONFLICT_CODES.has(current.code)) {
      return true;
    }
    current = "cause" in current ? current.cause : undefined;
  }
  return false;
}

export async function withTx<T>(db: Db, work: (tx: Tx) => Promise<T>): Promise<T> {
  try {
    return await db.transaction(work);
  } catch (error) {
    if (isConflictViolation(error)) {
      throw new ConflictError("The record conflicts with an existing one");
    }
    throw error;
  }
}
