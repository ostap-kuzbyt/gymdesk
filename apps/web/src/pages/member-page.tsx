import type { MemberView, SubscriptionView } from "@gymdesk/shared";
import { getRouteApi, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useSession } from "@/auth/session";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageHeader } from "@/components/page-header";
import { PlateBadge } from "@/components/plate-badge";
import { EmptyState, ErrorNotice, TableSkeleton } from "@/components/query-states";
import { Button } from "@/components/ui/button";
import { useCheckIn } from "@/features/use-check-in";
import { useCancelSubscription, useMember } from "@/features/members/api";
import { CoachSelect } from "@/features/members/coach-select";
import { EditMemberDialog } from "@/features/members/edit-member-dialog";
import { SellSubscriptionDialog } from "@/features/members/sell-subscription-dialog";
import { SubscriptionsTable } from "@/features/members/subscriptions-table";
import { VisitsTable } from "@/features/members/visits-table";
import { useTariffs } from "@/features/tariffs/api";
import { ApiError } from "@/lib/api";
import { messageOf } from "@/lib/errors";
import { formatDate, formatPeriod, todayLocal } from "@/lib/format";
import { isFrontDesk } from "@/lib/permissions";
import { plateFor } from "@/lib/plates";

const memberRoute = getRouteApi("/members/$memberId");

function currentSubscription(member: MemberView) {
  const active = member.subscriptions.find((subscription) => subscription.status === "active");
  if (active) return active;
  return member.subscriptions
    .filter((subscription) => subscription.status === "upcoming")
    .sort((a, b) => a.startsOn.localeCompare(b.startsOn))[0];
}

export function MemberPage() {
  const { memberId } = memberRoute.useParams();
  const member = useMember(memberId);

  if (member.isPending) return <TableSkeleton columns={3} rows={4} />;
  if (member.isError) {
    if (member.error instanceof ApiError && member.error.status === 404) {
      return (
        <EmptyState
          title="Member not found"
          hint="This member does not exist or was removed."
          action={
            <Link to="/members" className="font-medium text-primary hover:underline">
              Back to members
            </Link>
          }
        />
      );
    }
    return <ErrorNotice error={member.error} onRetry={() => void member.refetch()} />;
  }

  return <MemberProfile member={member.data} />;
}

function MemberProfile({ member }: { member: MemberView }) {
  const { roles } = useSession();
  const frontDesk = isFrontDesk(roles);
  const [editing, setEditing] = useState(false);
  const [selling, setSelling] = useState(false);
  const [toCancel, setToCancel] = useState<SubscriptionView | null>(null);
  const cancel = useCancelSubscription(member.id);
  const { checkIn, isPending } = useCheckIn();
  const tariffs = useTariffs(true);
  const today = todayLocal();
  const current = currentSubscription(member);
  const plate = current ? plateFor({ ...current, today }) : null;
  const tariffName = (id: string) =>
    tariffs.data?.find((tariff) => tariff.id === id)?.name ?? "Tariff";

  return (
    <section className="flex flex-col gap-10">
      <div>
        <p className="mb-2 text-sm text-muted-foreground">
          <Link to="/members" className="hover:text-foreground hover:underline">
            Members
          </Link>
        </p>
        <PageHeader
          title={member.fullName}
          description={`${member.age} years old`}
          actions={
            frontDesk ? (
              <>
                <Button variant="outline" onClick={() => setEditing(true)}>
                  Edit profile
                </Button>
                <Button
                  disabled={isPending}
                  onClick={() => checkIn({ id: member.id, name: member.fullName })}
                >
                  Check in
                </Button>
              </>
            ) : undefined
          }
        />

        <div className="flex flex-wrap items-center gap-x-10 gap-y-5">
          <div className="flex items-center gap-3">
            {plate ? <PlateBadge {...plate} size="lg" /> : null}
            <div>
              <div className="font-medium">
                {current
                  ? current.status === "active"
                    ? `Active until ${formatDate(current.endsOn)}`
                    : `Starts ${formatDate(current.startsOn)}`
                  : "No active subscription"}
              </div>
              <div className="text-sm text-muted-foreground">
                {plate?.label ?? (frontDesk ? "Sell one below" : "Nothing running")}
              </div>
            </div>
          </div>
          <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Email</dt>
            <dd>{member.email}</dd>
            <dt className="text-muted-foreground">Phone</dt>
            <dd>{member.phone ?? "–"}</dd>
            <dt className="text-muted-foreground">Coach</dt>
            <dd>
              <CoachSelect memberId={member.id} coachId={member.coachId} editable={frontDesk} />
            </dd>
          </dl>
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2>Subscriptions</h2>
          {frontDesk && member.subscriptions.length > 0 ? (
            <Button variant="outline" onClick={() => setSelling(true)}>
              Sell subscription
            </Button>
          ) : null}
        </div>
        {member.subscriptions.length === 0 ? (
          <EmptyState
            title="No subscriptions yet"
            hint="Subscriptions the member buys will be listed here."
            action={
              frontDesk ? (
                <Button onClick={() => setSelling(true)}>Sell subscription</Button>
              ) : undefined
            }
          />
        ) : (
          <SubscriptionsTable
            subscriptions={member.subscriptions}
            tariffs={tariffs.data ?? []}
            {...(frontDesk ? { onCancel: setToCancel } : {})}
          />
        )}
      </div>

      <div>
        <h2 className="mb-3">Visits</h2>
        <VisitsTable
          memberId={member.id}
          tariffByVisit={(subscriptionId) => {
            const subscription = member.subscriptions.find((item) => item.id === subscriptionId);
            return subscription ? tariffName(subscription.tariffId) : "–";
          }}
        />
      </div>

      <EditMemberDialog open={editing} onOpenChange={setEditing} member={member} />
      <SellSubscriptionDialog open={selling} onOpenChange={setSelling} member={member} />
      <ConfirmDialog
        open={toCancel !== null}
        onOpenChange={(open) => {
          if (!open) {
            setToCancel(null);
            cancel.reset();
          }
        }}
        title={`Cancel ${toCancel ? tariffName(toCancel.tariffId) : ""} subscription?`}
        description={
          toCancel
            ? `${formatPeriod(toCancel.startsOn, toCancel.endsOn)}. The member can no longer check in with it, and it is left out of revenue reports. Nothing is refunded automatically.`
            : ""
        }
        confirmLabel="Cancel subscription"
        pending={cancel.isPending}
        error={cancel.isError ? messageOf(cancel.error) : undefined}
        onConfirm={() => {
          if (!toCancel) return;
          cancel.mutate(toCancel.id, {
            onSuccess: () => {
              toast.success("Subscription cancelled");
              setToCancel(null);
            },
          });
        }}
      />
    </section>
  );
}
