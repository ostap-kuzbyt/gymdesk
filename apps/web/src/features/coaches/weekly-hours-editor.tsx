import { Plus, X } from "lucide-react";
import { useFieldArray } from "react-hook-form";
import type { Control, FieldErrors, UseFormRegister } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { WEEKDAY_LONG } from "@/lib/hours";
import type { CoachFormValues } from "./coach-form";

interface WeeklyHoursEditorProps {
  control: Control<CoachFormValues>;
  register: UseFormRegister<CoachFormValues>;
  errors: FieldErrors<CoachFormValues>;
}

export function WeeklyHoursEditor({ control, register, errors }: WeeklyHoursEditorProps) {
  const { fields, append, remove } = useFieldArray({ control, name: "weeklyHours" });

  function addWindow() {
    const used = new Set(fields.map((field) => field.weekday));
    const free = ["1", "2", "3", "4", "5", "6", "7"].find((day) => !used.has(day)) ?? "1";
    append({ weekday: free, from: "09:00", to: "17:00" });
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">Working hours</legend>
      {fields.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hours yet. A coach can only be given workouts inside their working hours.
        </p>
      ) : null}
      {fields.map((field, index) => {
        const rowErrors = errors.weeklyHours?.[index];
        const message =
          rowErrors?.from?.message ?? rowErrors?.to?.message ?? rowErrors?.weekday?.message;
        return (
          <div key={field.id} className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <NativeSelect
                size="sm"
                aria-label={`Day for window ${index + 1}`}
                {...register(`weeklyHours.${index}.weekday`)}
              >
                {WEEKDAY_LONG.map((name, day) => (
                  <NativeSelectOption key={name} value={String(day + 1)}>
                    {name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <Input
                type="time"
                className="h-7 w-28"
                aria-label={`Start of window ${index + 1}`}
                aria-invalid={!!rowErrors?.from}
                {...register(`weeklyHours.${index}.from`)}
              />
              <span aria-hidden className="text-muted-foreground">
                –
              </span>
              <Input
                type="time"
                className="h-7 w-28"
                aria-label={`End of window ${index + 1}`}
                aria-invalid={!!rowErrors?.to}
                {...register(`weeklyHours.${index}.to`)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`Remove window ${index + 1}`}
                onClick={() => remove(index)}
              >
                <X />
              </Button>
            </div>
            {message ? (
              <p role="alert" className="text-xs text-destructive">
                {message}
              </p>
            ) : null}
          </div>
        );
      })}
      <Button type="button" variant="outline" size="sm" className="self-start" onClick={addWindow}>
        <Plus />
        Add working hours
      </Button>
    </fieldset>
  );
}
