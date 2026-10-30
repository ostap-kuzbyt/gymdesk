import type { WorkoutView } from "@gymdesk/shared";
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
import { useCoaches } from "@/features/coaches/api";
import { MemberPicker } from "@/features/members/member-picker";
import { useStudios } from "@/features/studios/api";
import {
  useCancelReservation,
  useCancelWorkout,
  useReserve,
  useWorkout,
} from "@/features/workouts/api";
import { fillOf } from "@/features/workouts/capacity";
import { hasStarted } from "@/features/workouts/timing";
import { ApiError } from "@/lib/api";
import { messageOf } from "@/lib/errors";
import { formatDate, formatTime } from "@/lib/format";
import { WEEKDAY_SHORT, weekdayOf } from "@/lib/hours";
import { isFrontDesk } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const workoutRoute = getRouteApi("/workouts/$workoutId");

export function WorkoutPage() {
  const { workoutId } = workoutRoute.useParams();
  const workout = useWorkout(workoutId);

  if (workout.isPending) return <TableSkeleton columns={3} rows={4} />;
  if (workout.isError) {
    if (workout.error instanceof ApiError && workout.error.status === 404) {
      return (
        <EmptyState
          title="Workout not found"
          hint="This workout does not exist or was removed."
          action={
            <Link to="/schedule" className="font-medium text-primary hover:underline">
              Back to the schedule
            </Link>
          }
        />
      );
    }
    return <ErrorNotice error={workout.error} onRetry={() => void workout.refetch()} />;
  }

  return <WorkoutDetails workout={workout.data} />;
}

function WorkoutDetails({ workout }: { workout: WorkoutView }) {
  const { roles } = useSession();
  const frontDesk = isFrontDesk(roles);
  const studios = useStudios(true);
  const coaches = useCoaches(true);
  const reserve = useReserve(workout.id);
  const cancelReservation = useCancelReservation(workout.id);
  const cancelWorkout = useCancelWorkout(workout.id);
  const [cancellingWorkout, setCancellingWorkout] = useState(false);
  const [toDrop, setToDrop] = useState<WorkoutView["reservations"][number] | null>(null);

  const studio = studios.data?.find((item) => item.id === workout.studioId);
  const coach = coaches.data?.find((item) => item.id === workout.coachId);
  const started = hasStarted(workout);
  const open = !workout.cancelled && !started;
  const fill = fillOf(workout.reserved, workout.capacity);
  const active = workout.reservations.filter((item) => item.cancelledAt === null);
  const dropped = workout.reservations.filter((item) => item.cancelledAt !== null);
  const bookedIds = new Set(active.map((item) => item.memberId));
  const dayName = WEEKDAY_SHORT[weekdayOf(workout.date) - 1];

  return (
    <section className="flex flex-col gap-10">
      <div>
        <p className="mb-2 text-sm text-muted-foreground">
          <Link
            to="/schedule"
            search={{ week: undefined, studio: undefined, coach: undefined }}
            className="hover:text-foreground hover:underline"
          >
            Schedule
          </Link>
        </p>
        <PageHeader
          title={workout.title}
          description={`${dayName} ${formatDate(workout.date)} · ${workout.startTime}–${workout.endTime}`}
          actions={
            <>
              <Badge variant="secondary">
                {workout.kind === "group" ? "Group workout" : "Personal session"}
              </Badge>
              {workout.cancelled ? <Badge variant="destructive">Cancelled</Badge> : null}
              {frontDesk && open ? (
                <Button variant="outline" onClick={() => setCancellingWorkout(true)}>
                  Cancel workout
                </Button>
              ) : null}
            </>
          }
        />

        <dl className="grid max-w-md grid-cols-[6rem_1fr] gap-y-1.5">
          <dt className="text-muted-foreground">Studio</dt>
          <dd>{studio?.name ?? "–"}</dd>
          <dt className="text-muted-foreground">Coach</dt>
          <dd>
            {coach ? (
              <Link
                to="/coaches/$coachId"
                params={{ coachId: coach.id }}
                className="hover:text-primary hover:underline"
              >
                {coach.fullName}
              </Link>
            ) : (
              "–"
            )}
          </dd>
          <dt className="text-muted-foreground">Places</dt>
          <dd className="flex items-center gap-2">
            <span
              aria-hidden
              className={cn(
                "size-2.5 rounded-full",
                {
                  green: "bg-plate-green",
                  yellow: "bg-plate-yellow",
                  red: "bg-plate-red",
                  blue: "bg-plate-blue",
                  neutral: "bg-muted-foreground",
                }[fill.tone],
              )}
            />
            {workout.reserved} of {workout.capacity} · {fill.label}
          </dd>
        </dl>
      </div>

      <div>
        <h2 className="mb-3">Bookings</h2>
        {workout.reservations.length === 0 ? (
          <EmptyState
            title="Nobody has booked yet"
            hint={open && frontDesk ? "Find a member below to book them in." : undefined}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead className="hidden sm:table-cell">Booked</TableHead>
                <TableHead>Status</TableHead>
                {frontDesk && open ? <TableHead className="w-32" /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...active, ...dropped].map((reservation) => (
                <TableRow
                  key={reservation.id}
                  className={reservation.cancelledAt ? "text-muted-foreground" : undefined}
                >
                  <TableCell className="font-medium">
                    <Link
                      to="/members/$memberId"
                      params={{ memberId: reservation.memberId }}
                      className="hover:text-primary hover:underline"
                    >
                      {reservation.memberName}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden tabular-nums sm:table-cell">
                    {formatDate(reservation.reservedAt.slice(0, 10))}{" "}
                    {formatTime(reservation.reservedAt)}
                  </TableCell>
                  <TableCell>
                    {reservation.cancelledAt
                      ? `Cancelled ${formatTime(reservation.cancelledAt)}`
                      : "Booked"}
                  </TableCell>
                  {frontDesk && open ? (
                    <TableCell className="text-right">
                      {reservation.cancelledAt ? null : (
                        <Button variant="ghost" size="sm" onClick={() => setToDrop(reservation)}>
                          Cancel booking
                        </Button>
                      )}
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {frontDesk ? (
        <div>
          <h2 className="mb-3">Book a member</h2>
          {workout.cancelled ? (
            <p className="text-muted-foreground">
              This workout was cancelled, so it cannot take bookings.
            </p>
          ) : started ? (
            <p className="text-muted-foreground">
              This workout has started, so bookings are closed.
            </p>
          ) : workout.spotsLeft === 0 ? (
            <p className="text-muted-foreground">
              This workout is full. Cancel a booking to free a place.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              <MemberPicker
                actionLabel="Book"
                disabledIds={bookedIds}
                disabledLabel="Already booked"
                pending={reserve.isPending}
                onPick={(member) => {
                  reserve.reset();
                  reserve.mutate(member.id, {
                    onSuccess: () => toast.success(`${member.fullName} booked`),
                  });
                }}
              />
              {reserve.isError ? (
                <p role="alert" className="text-sm text-destructive">
                  {messageOf(reserve.error)}
                </p>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      <ConfirmDialog
        open={cancellingWorkout}
        onOpenChange={(next) => {
          setCancellingWorkout(next);
          if (!next) cancelWorkout.reset();
        }}
        title={`Cancel ${workout.title}?`}
        description={
          active.length > 0
            ? `${active.length} ${active.length === 1 ? "member is" : "members are"} booked. They are not notified automatically, so tell them in person.`
            : "Nobody is booked yet. The studio and coach become free for that time."
        }
        confirmLabel="Cancel workout"
        pending={cancelWorkout.isPending}
        error={cancelWorkout.isError ? messageOf(cancelWorkout.error) : undefined}
        onConfirm={() =>
          cancelWorkout.mutate(undefined, {
            onSuccess: () => {
              toast.success("Workout cancelled");
              setCancellingWorkout(false);
            },
          })
        }
      />
      <ConfirmDialog
        open={toDrop !== null}
        onOpenChange={(next) => {
          if (!next) {
            setToDrop(null);
            cancelReservation.reset();
          }
        }}
        title={`Cancel the booking of ${toDrop?.memberName ?? "this member"}?`}
        description="The place becomes free for someone else."
        confirmLabel="Cancel booking"
        pending={cancelReservation.isPending}
        error={cancelReservation.isError ? messageOf(cancelReservation.error) : undefined}
        onConfirm={() => {
          if (!toDrop) return;
          cancelReservation.mutate(toDrop.id, {
            onSuccess: () => {
              toast.success(`Booking of ${toDrop.memberName} cancelled`);
              setToDrop(null);
            },
          });
        }}
      />
    </section>
  );
}
