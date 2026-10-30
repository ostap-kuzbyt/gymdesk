import { Link, getRouteApi, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useSession } from "@/auth/session";
import { PageHeader } from "@/components/page-header";
import { EmptyState, ErrorNotice, TableSkeleton } from "@/components/query-states";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useReminders, useRetryReminder, useRunScan } from "@/features/reminders/api";
import { SendReminderDialog } from "@/features/reminders/send-reminder-dialog";
import { messageOf } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { isAdmin } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const remindersRoute = getRouteApi("/reminders");
const PAGE_SIZE = 25;

const KIND_LABELS = { expiry: "Expiry reminder", promo: "Promotion" } as const;
const STATUS_STYLES = {
  sent: { label: "Sent", dot: "bg-plate-green" },
  failed: { label: "Failed", dot: "bg-plate-red" },
  pending: { label: "Pending", dot: "bg-muted-foreground" },
} as const;

export function RemindersPage() {
  const { roles } = useSession();
  const search = remindersRoute.useSearch();
  const navigate = useNavigate();
  const page = search.page ?? 1;
  const [sending, setSending] = useState(false);
  const retry = useRetryReminder();
  const scan = useRunScan();

  const reminders = useReminders({
    status: search.status,
    kind: search.kind,
    offset: (page - 1) * PAGE_SIZE,
    limit: PAGE_SIZE,
  });

  function go(next: {
    status?: typeof search.status;
    kind?: typeof search.kind;
    page?: number | undefined;
  }) {
    void navigate({
      to: "/reminders",
      search: { status: next.status, kind: next.kind, page: next.page },
    });
  }

  const total = reminders.data?.total ?? 0;
  const first = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, total);

  return (
    <section>
      <PageHeader
        title="Reminders"
        description="Emails sent to members about their subscriptions."
        actions={
          <>
            {isAdmin(roles) ? (
              <Button
                variant="outline"
                disabled={scan.isPending}
                onClick={() =>
                  scan.mutate(undefined, {
                    onSuccess: (result) =>
                      toast.success("Expiry scan finished", {
                        description: `${result.sent} sent, ${result.failed} failed, ${result.skipped} skipped`,
                      }),
                    onError: (error) =>
                      toast.error("The scan did not run", { description: messageOf(error) }),
                  })
                }
              >
                Run expiry scan
              </Button>
            ) : null}
            <Button onClick={() => setSending(true)}>Send a reminder</Button>
          </>
        }
      />

      <div className="mb-5 flex flex-wrap gap-3">
        <NativeSelect
          size="sm"
          aria-label="Status"
          value={search.status ?? ""}
          onChange={(event) =>
            go({
              ...search,
              status: (event.target.value || undefined) as typeof search.status,
              page: undefined,
            })
          }
        >
          <NativeSelectOption value="">All statuses</NativeSelectOption>
          <NativeSelectOption value="failed">Failed</NativeSelectOption>
          <NativeSelectOption value="sent">Sent</NativeSelectOption>
          <NativeSelectOption value="pending">Pending</NativeSelectOption>
        </NativeSelect>
        <NativeSelect
          size="sm"
          aria-label="Type"
          value={search.kind ?? ""}
          onChange={(event) =>
            go({
              ...search,
              kind: (event.target.value || undefined) as typeof search.kind,
              page: undefined,
            })
          }
        >
          <NativeSelectOption value="">All types</NativeSelectOption>
          <NativeSelectOption value="expiry">Expiry reminders</NativeSelectOption>
          <NativeSelectOption value="promo">Promotions</NativeSelectOption>
        </NativeSelect>
      </div>

      {reminders.isPending ? <TableSkeleton columns={5} /> : null}
      {reminders.isError ? (
        <ErrorNotice error={reminders.error} onRetry={() => void reminders.refetch()} />
      ) : null}
      {reminders.data && reminders.data.items.length === 0 ? (
        search.status || search.kind ? (
          <EmptyState title="No reminders match" hint="Try another status or type." />
        ) : (
          <EmptyState
            title="No reminders yet"
            hint="Expiry reminders go out automatically every morning for subscriptions that end soon. You can also send one by hand."
            action={<Button onClick={() => setSending(true)}>Send a reminder</Button>}
          />
        )
      ) : null}
      {reminders.data && reminders.data.items.length > 0 ? (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead className="hidden sm:table-cell">Reminder</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">When</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {reminders.data.items.map((reminder) => {
                const status = STATUS_STYLES[reminder.status];
                return (
                  <TableRow key={reminder.id}>
                    <TableCell>
                      <Link
                        to="/members/$memberId"
                        params={{ memberId: reminder.memberId }}
                        className="font-medium hover:text-primary hover:underline"
                      >
                        {reminder.memberName}
                      </Link>
                      <div className="text-xs text-muted-foreground">{reminder.email}</div>
                      <div className="text-xs text-muted-foreground sm:hidden">
                        {KIND_LABELS[reminder.kind]} ·{" "}
                        {formatDateTime(reminder.sentAt ?? reminder.createdAt)}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {KIND_LABELS[reminder.kind]}
                      <div className="text-xs text-muted-foreground">
                        {reminder.trigger === "scan" ? "Automatic" : "Sent by hand"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        <span aria-hidden className={cn("size-2.5 rounded-full", status.dot)} />
                        {status.label}
                      </span>
                      {reminder.error ? (
                        <div className="mt-0.5 max-w-xs text-xs text-destructive">
                          {reminder.error}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="hidden tabular-nums md:table-cell">
                      {formatDateTime(reminder.sentAt ?? reminder.createdAt)}
                      {reminder.attempts > 1 ? (
                        <div className="text-xs text-muted-foreground">
                          {reminder.attempts} attempts
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">
                      {reminder.status === "failed" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={retry.isPending}
                          onClick={() =>
                            retry.mutate(reminder.id, {
                              onSuccess: (updated) =>
                                updated.status === "sent"
                                  ? toast.success(`Reminder sent to ${updated.memberName}`)
                                  : toast.error(`Reminder to ${updated.memberName} failed again`, {
                                      description: updated.error ?? undefined,
                                    }),
                              onError: (error) =>
                                toast.error("The reminder was not retried", {
                                  description: messageOf(error),
                                }),
                            })
                          }
                        >
                          Retry
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <nav
            aria-label="Pages of reminders"
            className="mt-4 flex items-center justify-between text-sm"
          >
            <p className="text-muted-foreground" aria-live="polite">
              {first}–{last} of {total}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => go({ ...search, page: page - 1 === 1 ? undefined : page - 1 })}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={last >= total}
                onClick={() => go({ ...search, page: page + 1 })}
              >
                Next
              </Button>
            </div>
          </nav>
        </>
      ) : null}

      <SendReminderDialog open={sending} onOpenChange={setSending} />
    </section>
  );
}
