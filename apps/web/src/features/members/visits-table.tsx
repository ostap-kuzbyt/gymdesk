import { useState } from "react";
import { EmptyState, ErrorNotice, TableSkeleton } from "@/components/query-states";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatTime } from "@/lib/format";
import { useVisits } from "./api";

const PAGE_SIZE = 10;

export function VisitsTable({
  memberId,
  tariffByVisit,
}: {
  memberId: string;
  tariffByVisit: (subscriptionId: string) => string;
}) {
  const [page, setPage] = useState(1);
  const visits = useVisits(memberId, (page - 1) * PAGE_SIZE, PAGE_SIZE);

  if (visits.isPending) return <TableSkeleton columns={3} rows={3} />;
  if (visits.isError)
    return <ErrorNotice error={visits.error} onRetry={() => void visits.refetch()} />;
  if (visits.data.total === 0) {
    return (
      <EmptyState
        title="No visits yet"
        hint="Check-ins appear here as soon as the member arrives."
      />
    );
  }

  const { items, total } = visits.data;
  const first = (page - 1) * PAGE_SIZE + 1;
  const last = first + items.length - 1;

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Arrived</TableHead>
            <TableHead>Subscription</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((visit) => (
            <TableRow key={visit.id}>
              <TableCell className="font-medium">{formatDate(visit.visitDate)}</TableCell>
              <TableCell className="tabular-nums">{formatTime(visit.checkedInAt)}</TableCell>
              <TableCell className="text-muted-foreground">
                {tariffByVisit(visit.subscriptionId)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <nav aria-label="Pages of visits" className="mt-4 flex items-center justify-between text-sm">
        <p className="text-muted-foreground" aria-live="polite">
          {first}–{last} of {total}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Newer
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={last >= total}
            onClick={() => setPage(page + 1)}
          >
            Older
          </Button>
        </div>
      </nav>
    </>
  );
}
