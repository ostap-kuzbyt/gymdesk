import { zodResolver } from "@hookform/resolvers/zod";
import type { TariffView } from "@gymdesk/shared";
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
import { useState } from "react";
import { applyApiError } from "@/lib/form-errors";
import { useSaveTariff } from "./api";
import { emptyTariffForm, formValuesOf, tariffFormSchema, toTariffInput } from "./tariff-form";
import type { TariffFormValues } from "./tariff-form";

interface TariffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tariff?: TariffView | undefined;
}

const API_FIELD_TO_FORM: Record<string, Path<TariffFormValues>> = {
  name: "name",
  priceCents: "price",
  durationDays: "durationDays",
  visitLimit: "visitLimit",
};

export function TariffDialog({ open, onOpenChange, tariff }: TariffDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open ? <TariffForm tariff={tariff} close={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function TariffForm({ tariff, close }: { tariff: TariffView | undefined; close: () => void }) {
  const [formError, setFormError] = useState<string | undefined>();
  const save = useSaveTariff(tariff);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<TariffFormValues>({
    resolver: zodResolver(tariffFormSchema),
    defaultValues: tariff ? formValuesOf(tariff) : emptyTariffForm,
  });

  const onSubmit = handleSubmit((values) => {
    setFormError(undefined);
    save.mutate(toTariffInput(values), {
      onSuccess: (saved) => {
        toast.success(tariff ? `${saved.name} updated` : `${saved.name} created`);
        close();
      },
      onError: (error) =>
        applyApiError<TariffFormValues>(error, {
          setError,
          fields: API_FIELD_TO_FORM,
          onForm: setFormError,
        }),
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{tariff ? `Edit ${tariff.name}` : "New tariff"}</DialogTitle>
        <DialogDescription>
          {tariff
            ? "Changes apply to new sales. Subscriptions already sold keep their price and visits."
            : "Set what a member gets and for how long."}
        </DialogDescription>
      </DialogHeader>

      <Field id="tariff-name" label="Name" error={errors.name?.message}>
        <Input
          id="tariff-name"
          autoComplete="off"
          aria-invalid={!!errors.name}
          {...register("name")}
        />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field id="tariff-price" label="Price" error={errors.price?.message}>
          <Input
            id="tariff-price"
            inputMode="decimal"
            aria-invalid={!!errors.price}
            {...register("price")}
          />
        </Field>
        <Field id="tariff-days" label="Valid for (days)" error={errors.durationDays?.message}>
          <Input
            id="tariff-days"
            inputMode="numeric"
            aria-invalid={!!errors.durationDays}
            {...register("durationDays")}
          />
        </Field>
      </div>
      <Field
        id="tariff-visits"
        label="Visit limit"
        hint="Leave empty for unlimited visits."
        error={errors.visitLimit?.message}
      >
        <Input
          id="tariff-visits"
          inputMode="numeric"
          aria-invalid={!!errors.visitLimit}
          {...register("visitLimit")}
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
          {tariff ? "Save changes" : "Create tariff"}
        </Button>
      </DialogFooter>
    </form>
  );
}
