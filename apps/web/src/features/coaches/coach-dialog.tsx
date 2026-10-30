import { zodResolver } from "@hookform/resolvers/zod";
import type { CoachView } from "@gymdesk/shared";
import { useState } from "react";
import { useForm } from "react-hook-form";
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
import { applyApiError } from "@/lib/form-errors";
import { useSaveCoach } from "./api";
import { coachFormSchema, emptyCoachForm, formValuesOf, toCoachInput } from "./coach-form";
import type { CoachFormValues } from "./coach-form";
import { WeeklyHoursEditor } from "./weekly-hours-editor";

const API_FIELD_TO_FORM: Record<string, Path<CoachFormValues>> = {
  fullName: "fullName",
  specialization: "specialization",
  weeklyHours: "weeklyHours",
  authSubject: "authSubject",
};

export function CoachDialog({
  open,
  onOpenChange,
  coach,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coach?: CoachView | undefined;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        {open ? <CoachForm coach={coach} close={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function CoachForm({ coach, close }: { coach: CoachView | undefined; close: () => void }) {
  const [formError, setFormError] = useState<string | undefined>();
  const save = useSaveCoach(coach);
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<CoachFormValues>({
    resolver: zodResolver(coachFormSchema),
    defaultValues: coach ? formValuesOf(coach) : emptyCoachForm,
  });

  const onSubmit = handleSubmit((values) => {
    setFormError(undefined);
    save.mutate(toCoachInput(values), {
      onSuccess: (saved) => {
        toast.success(coach ? `${saved.fullName} updated` : `${saved.fullName} added`);
        close();
      },
      onError: (error) =>
        applyApiError<CoachFormValues>(error, {
          setError,
          fields: API_FIELD_TO_FORM,
          onForm: setFormError,
        }),
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{coach ? `Edit ${coach.fullName}` : "New coach"}</DialogTitle>
        <DialogDescription>
          Workouts can only be scheduled inside a coach's working hours.
        </DialogDescription>
      </DialogHeader>

      <Field id="coach-name" label="Full name" error={errors.fullName?.message}>
        <Input
          id="coach-name"
          autoComplete="off"
          aria-invalid={!!errors.fullName}
          {...register("fullName")}
        />
      </Field>
      <Field id="coach-spec" label="Specialization" error={errors.specialization?.message}>
        <Input
          id="coach-spec"
          autoComplete="off"
          aria-invalid={!!errors.specialization}
          {...register("specialization")}
        />
      </Field>

      <Field
        id="coach-account"
        label="Sign-in account ID"
        hint="The user ID from Auth0, like auth0|64f2c1. A coach who signs in with it sees only their own schedule and members."
        error={errors.authSubject?.message}
      >
        <Input
          id="coach-account"
          autoComplete="off"
          spellCheck={false}
          placeholder="Optional"
          aria-invalid={!!errors.authSubject}
          {...register("authSubject")}
        />
      </Field>

      <WeeklyHoursEditor control={control} register={register} errors={errors} />

      {errors.weeklyHours?.message ? (
        <p role="alert" className="text-sm text-destructive">
          {errors.weeklyHours.message}
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
        <Button type="submit" disabled={save.isPending}>
          {coach ? "Save changes" : "Add coach"}
        </Button>
      </DialogFooter>
    </form>
  );
}
