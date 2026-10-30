import type { CoachView } from "@gymdesk/shared";
import { getRouteApi, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useSession } from "@/auth/session";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageHeader } from "@/components/page-header";
import { EmptyState, ErrorNotice, TableSkeleton } from "@/components/query-states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useArchiveCoach, useCoach, useCoachMembers } from "@/features/coaches/api";
import { CoachDialog } from "@/features/coaches/coach-dialog";
import { ActiveUntil } from "@/features/members/subscription-plate";
import { ApiError } from "@/lib/api";
import { messageOf } from "@/lib/errors";
import { WEEKDAY_LONG, windowsOnDay } from "@/lib/hours";
import { useMe } from "@/features/account/api";
import { isAdmin, isCoachOnly } from "@/lib/permissions";

const coachRoute = getRouteApi("/coaches/$coachId");
const PAGE_SIZE = 10;

export function CoachPage() {
  const { coachId } = coachRoute.useParams();
  const coach = useCoach(coachId);

  if (coach.isPending) return <TableSkeleton columns={3} rows={4} />;
  if (coach.isError) {
    if (coach.error instanceof ApiError && coach.error.status === 404) {
      return (
        <EmptyState
          title="Coach not found"
          hint="This coach does not exist or was removed."
          action={
            <Link to="/coaches" className="font-medium text-primary hover:underline">
              Back to coaches
            </Link>
          }
        />
      );
    }
    return <ErrorNotice error={coach.error} onRetry={() => void coach.refetch()} />;
  }

  return <CoachProfile coach={coach.data} />;
}

function CoachProfile({ coach }: { coach: CoachView }) {
  const { roles } = useSession();
  const canEdit = isAdmin(roles) && !coach.archived;
  const coachOnly = isCoachOnly(roles);
  const me = useMe(coachOnly);
  const ownProfile = !coachOnly || me.data?.coachId === coach.id;
  const [editing, setEditing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const archive = useArchiveCoach();

  return (
    <section className="flex flex-col gap-10">
      <div>
        <p className="mb-2 text-sm text-muted-foreground">
          <Link to="/coaches" className="hover:text-foreground hover:underline">
            Coaches
          </Link>
        </p>
        <PageHeader
          title={coach.fullName}
          description={coach.specialization}
          actions={
            <>
              {coach.archived ? <Badge variant="secondary">Archived</Badge> : null}
              {canEdit ? (
                <>
                  <Button variant="outline" onClick={() => setEditing(true)}>
                    Edit coach
                  </Button>
                  <Button variant="outline" onClick={() => setArchiving(true)}>
                    Archive
                  </Button>
                </>
              ) : null}
            </>
          }
        />
      </div>

      <div>
        <h2 className="mb-3">Working hours</h2>
        <dl className="grid max-w-md grid-cols-[8rem_1fr] gap-y-1.5">
          {WEEKDAY_LONG.map((name, index) => {
            const windows = windowsOnDay(coach.weeklyHours, index + 1);
            return (
              <div key={name} className="contents">
                <dt className="text-muted-foreground">{name}</dt>
                <dd>
                  {windows.length === 0 ? (
                    <span className="text-muted-foreground">Day off</span>
                  ) : (
                    windows.map((window) => `${window.from}–${window.to}`).join(", ")
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
      </div>

      {ownProfile ? <AssignedMembers coachId={coach.id} /> : null}
      {coachOnly && me.data && !ownProfile ? (
        <p className="text-muted-foreground">
          Only the front desk and this coach can see the members assigned to them.
        </p>
      ) : null}

      <CoachDialog open={editing} onOpenChange={setEditing} coach={coach} />
      <ConfirmDialog
        open={archiving}
        onOpenChange={(open) => {
          setArchiving(open);
          if (!open) archive.reset();
        }}
        title={`Archive ${coach.fullName}?`}
        description="They can no longer be given workouts or new members, and their profile cannot be changed."
        confirmLabel="Archive coach"
        pending={archive.isPending}
        error={archive.isError ? messageOf(archive.error) : undefined}
        onConfirm={() =>
          archive.mutate(coach, {
            onSuccess: (archived) => {
              toast.success(`${archived.fullName} archived`);
              setArchiving(false);
            },
          })
        }
      />
    </section>
  );
}

function AssignedMembers({ coachId }: { coachId: string }) {
  const [page, setPage] = useState(1);
  const members = useCoachMembers(coachId, (page - 1) * PAGE_SIZE, PAGE_SIZE);

  return (
    <div>
      <h2 className="mb-3">Members</h2>
      {members.isPending ? <TableSkeleton columns={2} rows={3} /> : null}
      {members.isError ? (
        <ErrorNotice error={members.error} onRetry={() => void members.refetch()} />
      ) : null}
      {members.data && members.data.total === 0 ? (
        <EmptyState title="No members assigned" hint="Assign this coach from a member's profile." />
      ) : null}
      {members.data && members.data.total > 0 ? (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Subscription</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.data.items.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <Link
                      to="/members/$memberId"
                      params={{ memberId: member.id }}
                      className="font-medium hover:text-primary hover:underline"
                    >
                      {member.fullName}
                    </Link>
                    <div className="text-xs text-muted-foreground">{member.email}</div>
                  </TableCell>
                  <TableCell>
                    <ActiveUntil activeUntil={member.activeUntil} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <nav
            aria-label="Pages of members"
            className="mt-4 flex items-center justify-between text-sm"
          >
            <p className="text-muted-foreground" aria-live="polite">
              {(page - 1) * PAGE_SIZE + 1}–{(page - 1) * PAGE_SIZE + members.data.items.length} of{" "}
              {members.data.total}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page * PAGE_SIZE >= members.data.total}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </nav>
        </>
      ) : null}
    </div>
  );
}
