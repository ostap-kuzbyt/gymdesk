import type { MemberView } from "@gymdesk/shared";
import { useState } from "react";
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
import { useTariffs } from "@/features/tariffs/api";
import { useCurrency } from "@/lib/config-context";
import { messageOf } from "@/lib/errors";
import {
  formatDate,
  formatMoney,
  formatPeriod,
  formatTerm,
  formatVisits,
  todayLocal,
} from "@/lib/format";
import { useSellSubscription } from "./api";
import { endsOn, findOverlap, suggestedStart } from "./sell";

export function SellSubscriptionDialog({
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
        {open ? <SellForm member={member} close={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function SellForm({ member, close }: { member: MemberView; close: () => void }) {
  const currency = useCurrency();
  const today = todayLocal();
  const tariffs = useTariffs(false);
  const sell = useSellSubscription(member.id);

  const [tariffId, setTariffId] = useState("");
  const [startsOn, setStartsOn] = useState(() => suggestedStart(member.subscriptions, today));
  const [submitted, setSubmitted] = useState(false);

  const tariff = tariffs.data?.find((item) => item.id === tariffId);
  const validStart = /^\d{4}-\d{2}-\d{2}$/.test(startsOn);
  const endDate = tariff && validStart ? endsOn(tariff, startsOn) : undefined;
  const overlap =
    endDate && validStart ? findOverlap(member.subscriptions, startsOn, endDate) : undefined;
  const startError = !validStart
    ? "Enter the first day"
    : startsOn < today
      ? "The first day cannot be in the past"
      : undefined;
  const tariffError = submitted && !tariff ? "Choose a tariff" : undefined;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (!tariff || startError || overlap) return;

    sell.mutate(
      { tariffId: tariff.id, startsOn },
      {
        onSuccess: () => {
          toast.success(`${tariff.name} sold to ${member.fullName}`);
          close();
        },
      },
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Sell a subscription</DialogTitle>
        <DialogDescription>
          For {member.fullName}. The price is fixed at the moment of sale.
        </DialogDescription>
      </DialogHeader>

      <Field id="sell-tariff" label="Tariff" error={tariffError}>
        <NativeSelect
          id="sell-tariff"
          className="w-full"
          value={tariffId}
          onChange={(event) => setTariffId(event.target.value)}
          aria-invalid={!!tariffError}
          disabled={tariffs.isPending}
        >
          <NativeSelectOption value="">Choose a tariff</NativeSelectOption>
          {tariffs.data?.map((item) => (
            <NativeSelectOption key={item.id} value={item.id}>
              {item.name} · {formatMoney(item.priceCents, currency)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      {tariffs.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {messageOf(tariffs.error)}
        </p>
      ) : null}

      <Field
        id="sell-start"
        label="First day"
        error={startError}
        hint={
          startsOn === suggestedStart(member.subscriptions, today) && startsOn !== today
            ? `Right after the current subscription ends.`
            : undefined
        }
      >
        <Input
          id="sell-start"
          type="date"
          value={startsOn}
          min={today}
          onChange={(event) => setStartsOn(event.target.value)}
          aria-invalid={!!startError}
        />
      </Field>

      {tariff && endDate ? (
        <p className="text-sm" aria-live="polite">
          <span className="font-medium">{formatPeriod(startsOn, endDate)}</span>
          <span className="text-muted-foreground">
            {" "}
            · {formatTerm(tariff.durationDays)} · {formatVisits(tariff.visitLimit)} ·{" "}
            {formatMoney(tariff.priceCents, currency)}
          </span>
        </p>
      ) : null}

      {overlap ? (
        <p role="alert" className="text-sm text-destructive">
          This overlaps the subscription from {formatDate(overlap.startsOn)} to{" "}
          {formatDate(overlap.endsOn)}. Start on{" "}
          {formatDate(suggestedStart(member.subscriptions, today))} or later.
        </p>
      ) : null}
      {sell.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {messageOf(sell.error)}
        </p>
      ) : null}

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={close}>
          Cancel
        </Button>
        <Button type="submit" disabled={sell.isPending || !!overlap}>
          Sell subscription
        </Button>
      </DialogFooter>
    </form>
  );
}
