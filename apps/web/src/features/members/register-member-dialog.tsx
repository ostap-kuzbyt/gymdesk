import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "@tanstack/react-router";
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
import { useRegisterMember } from "./api";
import { emptyMemberForm, memberFormSchema, toNewMember } from "./member-form";
import type { MemberFormValues } from "./member-form";

const API_FIELD_TO_FORM: Record<string, Path<MemberFormValues>> = {
  fullName: "fullName",
  birthDate: "birthDate",
  email: "email",
  phone: "phone",
};

export function RegisterMemberDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open ? <RegisterForm close={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function RegisterForm({ close }: { close: () => void }) {
  const [formError, setFormError] = useState<string | undefined>();
  const navigate = useNavigate();
  const register = useRegisterMember();
  const {
    register: field,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<MemberFormValues>({
    resolver: zodResolver(memberFormSchema),
    defaultValues: emptyMemberForm,
  });

  const onSubmit = handleSubmit((values) => {
    setFormError(undefined);
    register.mutate(toNewMember(values), {
      onSuccess: (member) => {
        toast.success(`${member.fullName} registered`);
        close();
        void navigate({ to: "/members/$memberId", params: { memberId: member.id } });
      },
      onError: (error) => {
        if (error instanceof ApiError && error.status === 409) {
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
        <DialogTitle>Register a member</DialogTitle>
        <DialogDescription>You can sell them a subscription on the next page.</DialogDescription>
      </DialogHeader>

      <Field id="member-name" label="Full name" error={errors.fullName?.message}>
        <Input
          id="member-name"
          autoComplete="off"
          aria-invalid={!!errors.fullName}
          {...field("fullName")}
        />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field id="member-birth" label="Date of birth" error={errors.birthDate?.message}>
          <Input
            id="member-birth"
            type="date"
            aria-invalid={!!errors.birthDate}
            {...field("birthDate")}
          />
        </Field>
        <Field id="member-phone" label="Phone" error={errors.phone?.message}>
          <Input
            id="member-phone"
            type="tel"
            placeholder="+380501234567"
            aria-invalid={!!errors.phone}
            {...field("phone")}
          />
        </Field>
      </div>
      <Field
        id="member-email"
        label="Email"
        hint="Expiry reminders are sent here."
        error={errors.email?.message}
      >
        <Input
          id="member-email"
          type="email"
          autoComplete="off"
          aria-invalid={!!errors.email}
          {...field("email")}
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
        <Button type="submit" disabled={register.isPending}>
          Register member
        </Button>
      </DialogFooter>
    </form>
  );
}
