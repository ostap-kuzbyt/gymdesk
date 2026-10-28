import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { Path } from "react-hook-form";
import { toast } from "sonner";
import { Field } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useCoaches } from "@/features/coaches/api";
import { useStudios } from "@/features/studios/api";
import { applyApiError } from "@/lib/form-errors";
import { todayLocal } from "@/lib/format";
import { WEEKDAY_LONG, weekdayOf, windowsOnDay, worksAt } from "@/lib/hours";
import { mondayOf } from "@/lib/week";
import { useScheduleWorkout } from "./api";
import { emptyWorkoutForm, startProblem, toNewWorkout, workoutFormSchema } from "./workout-form";
import type { WorkoutFormValues } from "./workout-form";

const API_FIELD_TO_FORM: Record<string, Path<WorkoutFormValues>> = {
  title: "title",
  kind: "kind",
  studioId: "studioId",
  coachId: "coachId",
  date: "date",
  startTime: "startTime",
  endTime: "endTime",
  capacity: "capacity",
};

function nowTime(): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date());
}

export function WorkoutDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        {open ? <WorkoutForm close={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function WorkoutForm({ close }: { close: () => void }) {
  const [formError, setFormError] = useState<string | undefined>();
  const navigate = useNavigate();
  const studios = useStudios(false);
  const coaches = useCoaches(false);
  const schedule = useScheduleWorkout();
  const today = todayLocal();
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors },
  } = useForm<WorkoutFormValues>({
    resolver: zodResolver(workoutFormSchema),
    defaultValues: emptyWorkoutForm(today),
  });

  const watched = useWatch({ control });
  const values = {
    kind: watched.kind ?? "group",
    studioId: watched.studioId ?? "",
    coachId: watched.coachId ?? "",
    date: watched.date ?? "",
    startTime: watched.startTime ?? "",
    endTime: watched.endTime ?? "",
  };
  const studio = studios.data?.find((item) => item.id === values.studioId);
  const coach = coaches.data?.find((item) => item.id === values.coachId);
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(values.date);
  const timesOk =
    /^\d{2}:\d{2}$/.test(values.startTime) &&
    /^\d{2}:\d{2}$/.test(values.endTime) &&
    values.startTime < values.endTime;
  const outsideHours =
    coach &&
    dateOk &&
    timesOk &&
    !worksAt(coach.weeklyHours, values.date, values.startTime, values.endTime);
  const hoursThatDay =
    coach && dateOk ? windowsOnDay(coach.weeklyHours, weekdayOf(values.date)) : [];

  const onSubmit = handleSubmit((form) => {
    setFormError(undefined);

    const problem = startProblem(form, today, nowTime());
    if (problem) {
      setError(form.date === today ? "startTime" : "date", { message: problem });
      return;
    }
    if (
      form.kind === "group" &&
      studio &&
      form.capacity !== "" &&
      Number(form.capacity) > studio.capacity
    ) {
      setError("capacity", { message: `${studio.name} holds ${studio.capacity} people` });
      return;
    }

    schedule.mutate(toNewWorkout(form), {
      onSuccess: (created) => {
        toast.success(`${created.title} scheduled`, {
          action: {
            label: "Open",
            onClick: () =>
              void navigate({ to: "/workouts/$workoutId", params: { workoutId: created.id } }),
          },
        });
        close();
        void navigate({
          to: "/schedule",
          search: {
            week: mondayOf(created.date) === mondayOf(today) ? undefined : mondayOf(created.date),
            studio: undefined,
            coach: undefined,
          },
        });
      },
      onError: (error) =>
        applyApiError<WorkoutFormValues>(error, {
          setError,
          fields: API_FIELD_TO_FORM,
          onForm: setFormError,
        }),
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>New workout</DialogTitle>
        <DialogDescription>Pick a studio and a coach who works at that time.</DialogDescription>
      </DialogHeader>

      <Field id="workout-title" label="Title" error={errors.title?.message}>
        <Input
          id="workout-title"
          autoComplete="off"
          aria-invalid={!!errors.title}
          {...register("title")}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field id="workout-kind" label="Type">
          <NativeSelect id="workout-kind" className="w-full" {...register("kind")}>
            <NativeSelectOption value="group">Group workout</NativeSelectOption>
            <NativeSelectOption value="individual">Personal session</NativeSelectOption>
          </NativeSelect>
        </Field>
        {values.kind === "group" ? (
          <Field
            id="workout-places"
            label="Places"
            hint={
              studio ? `Leave empty to use all ${studio.capacity} places of the studio.` : undefined
            }
            error={errors.capacity?.message}
          >
            <Input
              id="workout-places"
              inputMode="numeric"
              aria-invalid={!!errors.capacity}
              {...register("capacity")}
            />
          </Field>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field id="workout-studio" label="Studio" error={errors.studioId?.message}>
          <NativeSelect
            id="workout-studio"
            className="w-full"
            aria-invalid={!!errors.studioId}
            {...register("studioId")}
          >
            <NativeSelectOption value="">Choose a studio</NativeSelectOption>
            {studios.data?.map((item) => (
              <NativeSelectOption key={item.id} value={item.id}>
                {item.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field id="workout-coach" label="Coach" error={errors.coachId?.message}>
          <NativeSelect
            id="workout-coach"
            className="w-full"
            aria-invalid={!!errors.coachId}
            {...register("coachId")}
          >
            <NativeSelectOption value="">Choose a coach</NativeSelectOption>
            {coaches.data?.map((item) => (
              <NativeSelectOption key={item.id} value={item.id}>
                {item.fullName}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Field id="workout-date" label="Date" error={errors.date?.message}>
          <Input
            id="workout-date"
            type="date"
            min={today}
            aria-invalid={!!errors.date}
            {...register("date")}
          />
        </Field>
        <Field id="workout-start" label="Starts" error={errors.startTime?.message}>
          <Input
            id="workout-start"
            type="time"
            aria-invalid={!!errors.startTime}
            {...register("startTime")}
          />
        </Field>
        <Field id="workout-end" label="Ends" error={errors.endTime?.message}>
          <Input
            id="workout-end"
            type="time"
            aria-invalid={!!errors.endTime}
            {...register("endTime")}
          />
        </Field>
      </div>

      {coach && outsideHours ? (
        <p role="status" className="text-sm text-muted-foreground">
          {coach.fullName} is not scheduled to work then.{" "}
          {hoursThatDay.length === 0
            ? `They have no hours on ${WEEKDAY_LONG[weekdayOf(values.date) - 1]}s.`
            : `Their hours that day: ${hoursThatDay.map((window) => `${window.from}–${window.to}`).join(", ")}.`}
        </p>
      ) : null}

      {formError ? (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      ) : null}

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={close}>
          Cancel
        </Button>
        <Button type="submit" disabled={schedule.isPending}>
          Schedule workout
        </Button>
      </DialogFooter>
    </form>
  );
}
