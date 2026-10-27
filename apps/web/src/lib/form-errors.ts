import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { fieldErrorsOf, messageOf } from "./errors";

interface ApplyOptions<T extends FieldValues> {
  setError: UseFormSetError<T>;
  fields: Record<string, Path<T>>;
  onForm: (message: string) => void;
}

export function applyApiError<T extends FieldValues>(
  error: unknown,
  options: ApplyOptions<T>,
): void {
  const mapped = Object.entries(fieldErrorsOf(error)).filter(([path]) => path in options.fields);

  for (const [path, message] of mapped) {
    const field = options.fields[path];
    if (field) options.setError(field, { message });
  }
  if (mapped.length === 0) options.onForm(messageOf(error));
}
