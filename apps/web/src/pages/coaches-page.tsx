import type { CoachView } from "@gymdesk/shared";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useSession } from "@/auth/session";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageHeader } from "@/components/page-header";
import { EmptyState, ErrorNotice, TableSkeleton } from "@/components/query-states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useArchiveCoach, useCoaches } from "@/features/coaches/api";
import { CoachDialog } from "@/features/coaches/coach-dialog";
import { messageOf } from "@/lib/errors";
import { summariseHours } from "@/lib/hours";
import { isAdmin } from "@/lib/permissions";

export function CoachesPage() {
  const { roles } = useSession();
  const canEdit = isAdmin(roles);
  const [includeArchived, setIncludeArchived] = useState(false);
  const coaches = useCoaches(includeArchived);
  const archive = useArchiveCoach();

  const [dialog, setDialog] = useState<{ open: boolean; coach?: CoachView }>({ open: false });
  const [toArchive, setToArchive] = useState<CoachView | null>(null);

  const addButton = canEdit ? (
    <Button onClick={() => setDialog({ open: true })}>New coach</Button>
  ) : undefined;

  return (
    <section>
      <PageHeader
        title="Coaches"
        description="Who trains members, and when they work."
        actions={
          <>
            <div className="flex items-center gap-2">
              <Switch
                id="show-archived"
                checked={includeArchived}
                onCheckedChange={setIncludeArchived}
              />
              <Label htmlFor="show-archived">Show archived</Label>
            </div>
            {addButton}
          </>
        }
      />

      {coaches.isPending ? <TableSkeleton columns={canEdit ? 3 : 2} /> : null}
      {coaches.isError ? (
        <ErrorNotice error={coaches.error} onRetry={() => void coaches.refetch()} />
      ) : null}
      {coaches.data && coaches.data.length === 0 ? (
        <EmptyState
          title="No coaches yet"
          hint={
            canEdit
              ? "Add a coach with their working hours to start scheduling workouts."
              : "An admin has not added any coaches yet."
          }
          action={addButton}
        />
      ) : null}
      {coaches.data && coaches.data.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Coach</TableHead>
              <TableHead>Working hours</TableHead>
              {canEdit ? <TableHead className="w-40" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {coaches.data.map((coach) => {
              const hours = summariseHours(coach.weeklyHours);
              return (
                <TableRow
                  key={coach.id}
                  className={coach.archived ? "text-muted-foreground" : undefined}
                >
                  <TableCell>
                    <Link
                      to="/coaches/$coachId"
                      params={{ coachId: coach.id }}
                      className="font-medium hover:text-primary hover:underline"
                    >
                      {coach.fullName}
                    </Link>
                    {coach.archived ? (
                      <Badge variant="secondary" className="ml-2">
                        Archived
                      </Badge>
                    ) : null}
                    <div className="text-xs text-muted-foreground">{coach.specialization}</div>
                  </TableCell>
                  <TableCell>
                    {hours.length === 0 ? (
                      <span className="text-muted-foreground">No hours set</span>
                    ) : (
                      hours.map((line) => <div key={line}>{line}</div>)
                    )}
                  </TableCell>
                  {canEdit ? (
                    <TableCell className="text-right">
                      {coach.archived ? null : (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDialog({ open: true, coach })}
                          >
                            Edit
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setToArchive(coach)}>
                            Archive
                          </Button>
                        </>
                      )}
                    </TableCell>
                  ) : null}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      ) : null}

      <CoachDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((current) => ({ ...current, open }))}
        coach={dialog.coach}
      />
      <ConfirmDialog
        open={toArchive !== null}
        onOpenChange={(open) => {
          if (!open) {
            setToArchive(null);
            archive.reset();
          }
        }}
        title={`Archive ${toArchive?.fullName ?? "coach"}?`}
        description="They can no longer be given workouts or new members, and their profile cannot be changed. Workouts already scheduled stay as they are."
        confirmLabel="Archive coach"
        pending={archive.isPending}
        error={archive.isError ? messageOf(archive.error) : undefined}
        onConfirm={() => {
          if (!toArchive) return;
          archive.mutate(toArchive, {
            onSuccess: (archived) => {
              toast.success(`${archived.fullName} archived`);
              setToArchive(null);
            },
          });
        }}
      />
    </section>
  );
}
