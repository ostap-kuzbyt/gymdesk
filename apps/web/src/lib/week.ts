import { addDays } from "./dates";
import { weekdayOf } from "./hours";

export function mondayOf(isoDate: string): string {
  return addDays(isoDate, 1 - weekdayOf(isoDate));
}

export function weekDays(monday: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}
