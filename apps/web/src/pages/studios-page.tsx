import type { StudioView } from "@gymdesk/shared";
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
import { useArchiveStudio, useStudios } from "@/features/studios/api";
import { StudioDialog } from "@/features/studios/studio-dialog";
import { messageOf } from "@/lib/errors";
import { isAdmin } from "@/lib/permissions";

export function StudiosPage() {
  const { roles } = useSession();
  const canEdit = isAdmin(roles);
  const [includeArchived, setIncludeArchived] = useState(false);
  const studios = useStudios(includeArchived);
  const archive = useArchiveStudio();

  const [dialog, setDialog] = useState<{ open: boolean; studio?: StudioView }>({ open: false });
  const [toArchive, setToArchive] = useState<StudioView | null>(null);

  const createButton = canEdit ? (
    <Button onClick={() => setDialog({ open: true })}>New studio</Button>
  ) : undefined;

  return (
    <section>
      <PageHeader
        title="Studios"
        description="The rooms where workouts take place."
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
            {createButton}
          </>
        }
      />

      {studios.isPending ? <TableSkeleton columns={canEdit ? 3 : 2} /> : null}
      {studios.isError ? (
        <ErrorNotice error={studios.error} onRetry={() => void studios.refetch()} />
      ) : null}
      {studios.data && studios.data.length === 0 ? (
        <EmptyState
          title="No studios yet"
          hint={
            canEdit
              ? "Workouts need a studio to take place in."
              : "An admin has not added any studios yet."
          }
          action={createButton}
        />
      ) : null}
      {studios.data && studios.data.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Capacity</TableHead>
              {canEdit ? <TableHead className="w-40" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {studios.data.map((studio) => (
              <TableRow
                key={studio.id}
                className={studio.archived ? "text-muted-foreground" : undefined}
              >
                <TableCell className="font-medium">
                  {studio.name}
                  {studio.archived ? (
                    <Badge variant="secondary" className="ml-2">
                      Archived
                    </Badge>
                  ) : null}
                </TableCell>
                <TableCell>
                  {studio.capacity === 1 ? "1 person" : `${studio.capacity} people`}
                </TableCell>
                {canEdit ? (
                  <TableCell className="text-right">
                    {studio.archived ? null : (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDialog({ open: true, studio })}
                        >
                          Edit
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setToArchive(studio)}>
                          Archive
                        </Button>
                      </>
                    )}
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}

      <StudioDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((current) => ({ ...current, open }))}
        studio={dialog.studio}
      />
      <ConfirmDialog
        open={toArchive !== null}
        onOpenChange={(open) => {
          if (!open) {
            setToArchive(null);
            archive.reset();
          }
        }}
        title={`Archive ${toArchive?.name ?? "studio"}?`}
        description="No new workouts can be scheduled in it, and it cannot be changed. Workouts already scheduled stay as they are."
        confirmLabel="Archive studio"
        pending={archive.isPending}
        error={archive.isError ? messageOf(archive.error) : undefined}
        onConfirm={() => {
          if (!toArchive) return;
          archive.mutate(toArchive, {
            onSuccess: (archived) => {
              toast.success(`${archived.name} archived`);
              setToArchive(null);
            },
          });
        }}
      />
    </section>
  );
}
