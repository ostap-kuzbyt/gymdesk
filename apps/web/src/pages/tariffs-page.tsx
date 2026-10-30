import type { TariffView } from "@gymdesk/shared";
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
import { useArchiveTariff, useTariffs } from "@/features/tariffs/api";
import { TariffDialog } from "@/features/tariffs/tariff-dialog";
import { useCurrency } from "@/lib/config-context";
import { messageOf } from "@/lib/errors";
import { formatMoney, formatTerm, formatVisits } from "@/lib/format";
import { isAdmin } from "@/lib/permissions";

export function TariffsPage() {
  const { roles } = useSession();
  const currency = useCurrency();
  const canEdit = isAdmin(roles);
  const [includeArchived, setIncludeArchived] = useState(false);
  const tariffs = useTariffs(includeArchived);
  const archive = useArchiveTariff();

  const [dialog, setDialog] = useState<{ open: boolean; tariff?: TariffView }>({ open: false });
  const [toArchive, setToArchive] = useState<TariffView | null>(null);

  const createButton = canEdit ? (
    <Button onClick={() => setDialog({ open: true })}>New tariff</Button>
  ) : undefined;

  return (
    <section>
      <PageHeader
        title="Tariffs"
        description="What members can buy, and for how long it lasts."
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

      {tariffs.isPending ? <TableSkeleton columns={canEdit ? 5 : 4} /> : null}
      {tariffs.isError ? (
        <ErrorNotice error={tariffs.error} onRetry={() => void tariffs.refetch()} />
      ) : null}
      {tariffs.data && tariffs.data.length === 0 ? (
        <EmptyState
          title="No tariffs yet"
          hint={
            canEdit
              ? "Members need a tariff before you can sell them a subscription."
              : "An admin has not added any tariffs yet."
          }
          action={createButton}
        />
      ) : null}
      {tariffs.data && tariffs.data.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="hidden sm:table-cell">Valid for</TableHead>
              <TableHead className="hidden sm:table-cell">Visits</TableHead>
              {canEdit ? <TableHead className="w-40" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {tariffs.data.map((tariff) => (
              <TableRow
                key={tariff.id}
                className={tariff.archived ? "text-muted-foreground" : undefined}
              >
                <TableCell className="font-medium">
                  {tariff.name}
                  {tariff.archived ? (
                    <Badge variant="secondary" className="ml-2">
                      Archived
                    </Badge>
                  ) : null}
                  <div className="text-xs font-normal text-muted-foreground sm:hidden">
                    {formatTerm(tariff.durationDays)} · {formatVisits(tariff.visitLimit)}
                  </div>
                </TableCell>
                <TableCell className="text-right font-stamp tabular-nums">
                  {formatMoney(tariff.priceCents, currency)}
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  {formatTerm(tariff.durationDays)}
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  {formatVisits(tariff.visitLimit)}
                </TableCell>
                {canEdit ? (
                  <TableCell className="text-right">
                    {tariff.archived ? null : (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDialog({ open: true, tariff })}
                        >
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setToArchive(tariff)}>
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

      <TariffDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((current) => ({ ...current, open }))}
        tariff={dialog.tariff}
      />
      <ConfirmDialog
        open={toArchive !== null}
        onOpenChange={(open) => {
          if (!open) {
            setToArchive(null);
            archive.reset();
          }
        }}
        title={`Archive ${toArchive?.name ?? "tariff"}?`}
        description="Members who already have it keep their subscription. It can no longer be sold, and it cannot be changed."
        confirmLabel="Archive tariff"
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
