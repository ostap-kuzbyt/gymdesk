import { zodResolver } from "@hookform/resolvers/zod";
import type { StudioView } from "@gymdesk/shared";
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
import { useSaveStudio } from "./api";
import { emptyStudioForm, formValuesOf, studioFormSchema, toStudioInput } from "./studio-form";
import type { StudioFormValues } from "./studio-form";

interface StudioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studio?: StudioView | undefined;
}

const API_FIELD_TO_FORM: Record<string, Path<StudioFormValues>> = {
  name: "name",
  capacity: "capacity",
};

export function StudioDialog({ open, onOpenChange, studio }: StudioDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open ? <StudioForm studio={studio} close={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function StudioForm({ studio, close }: { studio: StudioView | undefined; close: () => void }) {
  const [formError, setFormError] = useState<string | undefined>();
  const save = useSaveStudio(studio);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<StudioFormValues>({
    resolver: zodResolver(studioFormSchema),
    defaultValues: studio ? formValuesOf(studio) : emptyStudioForm,
  });

  const onSubmit = handleSubmit((values) => {
    setFormError(undefined);
    save.mutate(toStudioInput(values), {
      onSuccess: (saved) => {
        toast.success(studio ? `${saved.name} updated` : `${saved.name} created`);
        close();
      },
      onError: (error) =>
        applyApiError<StudioFormValues>(error, {
          setError,
          fields: API_FIELD_TO_FORM,
          onForm: setFormError,
        }),
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{studio ? `Edit ${studio.name}` : "New studio"}</DialogTitle>
        <DialogDescription>
          Group workouts cannot have more places than the studio holds.
        </DialogDescription>
      </DialogHeader>

      <Field id="studio-name" label="Name" error={errors.name?.message}>
        <Input
          id="studio-name"
          autoComplete="off"
          aria-invalid={!!errors.name}
          {...register("name")}
        />
      </Field>
      <Field
        id="studio-capacity"
        label="Capacity"
        hint="How many people fit at once."
        error={errors.capacity?.message}
      >
        <Input
          id="studio-capacity"
          inputMode="numeric"
          aria-invalid={!!errors.capacity}
          {...register("capacity")}
        />
      </Field>

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
          {studio ? "Save changes" : "Create studio"}
        </Button>
      </DialogFooter>
    </form>
  );
}
