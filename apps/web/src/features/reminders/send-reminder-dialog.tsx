import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MemberPicker } from "@/features/members/member-picker";
import { messageOf } from "@/lib/errors";
import { useSendReminder } from "./api";

interface Target {
  id: string;
  fullName: string;
}

const KINDS = [
  {
    value: "expiry" as const,
    label: "Expiry reminder",
    hint: "Tells them when their current subscription ends.",
  },
  {
    value: "promo" as const,
    label: "Promotion",
    hint: "Offers a discount on their next subscription.",
  },
];

export function SendReminderDialog({
  open,
  onOpenChange,
  member,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member?: Target | undefined;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open ? <SendForm member={member} close={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function SendForm({ member, close }: { member: Target | undefined; close: () => void }) {
  const [chosen, setChosen] = useState<Target | undefined>(member);
  const [kind, setKind] = useState<"expiry" | "promo">("expiry");
  const send = useSendReminder();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!chosen) return;
    send.mutate(
      { memberId: chosen.id, kind },
      {
        onSuccess: (reminder) => {
          if (reminder.status === "sent") {
            toast.success(`Reminder sent to ${chosen.fullName}`, { description: reminder.email });
          } else {
            toast.error(`Reminder to ${chosen.fullName} was not delivered`, {
              description:
                reminder.error ??
                "The mail service refused it. You can retry from the Reminders page.",
            });
          }
          close();
        },
      },
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>Send a reminder</DialogTitle>
        <DialogDescription>
          The email goes to the address on the member's profile.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Member</span>
        {chosen ? (
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium">{chosen.fullName}</span>
            {member ? null : (
              <Button type="button" variant="ghost" size="sm" onClick={() => setChosen(undefined)}>
                Change
              </Button>
            )}
          </div>
        ) : (
          <MemberPicker
            actionLabel="Choose"
            disabledIds={new Set()}
            disabledLabel=""
            pending={false}
            onPick={(picked) => setChosen({ id: picked.id, fullName: picked.fullName })}
          />
        )}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">What to send</legend>
        {KINDS.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-start gap-3 rounded-md p-1.5 hover:bg-muted"
          >
            <input
              type="radio"
              name="reminder-kind"
              value={option.value}
              checked={kind === option.value}
              onChange={() => setKind(option.value)}
              className="mt-1 accent-primary"
            />
            <span>
              <span className="block font-medium">{option.label}</span>
              <span className="block text-sm text-muted-foreground">{option.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {send.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {messageOf(send.error)}
        </p>
      ) : null}

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={close}>
          Cancel
        </Button>
        <Button type="submit" disabled={!chosen || send.isPending}>
          Send reminder
        </Button>
      </DialogFooter>
    </form>
  );
}
