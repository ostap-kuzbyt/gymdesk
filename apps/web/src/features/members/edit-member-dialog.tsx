import { zodResolver } from "@hookform/resolvers/zod";
import type { MemberView } from "@gymdesk/shared";
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
import { ApiError } from "@/lib/api";
import { applyApiError } from "@/lib/form-errors";
import { useUpdateMember } from "./api";
import { formValuesOf, memberFormSchema, toMemberChanges } from "./member-form";
import type { MemberFormValues } from "./member-form";

const API_FIELD_TO_FORM: Record<string, Path<MemberFormValues>> = {
  fullName: "fullName",
  birthDate: "birthDate",
  email: "email",
  phone: "phone",
};

export function EditMemberDialog({
  open,
  onOpenChange,
  member,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: MemberView;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open ? <EditForm member={member} close={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function EditForm({ member, close }: { member: MemberView; close: () => void }) {
  const [formError, setFormError] = useState<string | undefined>();
  const update = useUpdateMember(member);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<MemberFormValues>({
    resolver: zodResolver(memberFormSchema),
    defaultValues: formValuesOf(member),
  });

  const onSubmit = handleSubmit((values) => {
    setFormError(undefined);
    update.mutate(toMemberChanges(values), {
      onSuccess: (saved) => {
        toast.success(`${saved.fullName} updated`);
        close();
      },
      onError: (error) => {
        if (
          error instanceof ApiError &&
          error.status === 409 &&
          /email|record/i.test(error.message)
        ) {
          setError("email", { message: "A member with this email already exists" });
          return;
        }
        applyApiError<MemberFormValues>(error, {
          setError,
          fields: API_FIELD_TO_FORM,
          onForm: setFormError,
        });
      },
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Edit {member.fullName}</DialogTitle>
        <DialogDescription>Update contact details or fix a typo.</DialogDescription>
      </DialogHeader>

      <Field id="edit-name" label="Full name" error={errors.fullName?.message}>
        <Input
          id="edit-name"
          autoComplete="off"
          aria-invalid={!!errors.fullName}
          {...register("fullName")}
        />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id="edit-birth" label="Date of birth" error={errors.birthDate?.message}>
          <Input
            id="edit-birth"
            type="date"
            aria-invalid={!!errors.birthDate}
            {...register("birthDate")}
          />
        </Field>
        <Field id="edit-phone" label="Phone" error={errors.phone?.message}>
          <Input
            id="edit-phone"
            type="tel"
            placeholder="+380501234567"
            aria-invalid={!!errors.phone}
            {...register("phone")}
          />
        </Field>
      </div>
      <Field id="edit-email" label="Email" error={errors.email?.message}>
        <Input
          id="edit-email"
          type="email"
          autoComplete="off"
          aria-invalid={!!errors.email}
          {...register("email")}
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
        <Button type="submit" disabled={update.isPending}>
          Save changes
        </Button>
      </DialogFooter>
    </form>
  );
}
