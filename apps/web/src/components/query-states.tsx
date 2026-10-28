import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { messageOf } from "@/lib/errors";

export function ErrorNotice({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div role="alert" className="flex max-w-lg flex-col items-start gap-3 py-6">
      <h2>Could not load this page</h2>
      <p className="text-muted-foreground">{messageOf(error)}</p>
      <Button variant="outline" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string | undefined;
  action?: ReactNode;
}) {
  return (
    <div className="flex max-w-lg flex-col items-start gap-3 py-10">
      <h2>{title}</h2>
      {hint ? <p className="text-muted-foreground">{hint}</p> : null}
      {action}
    </div>
  );
}

export function TableSkeleton({ rows = 5, columns }: { rows?: number; columns: number }) {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col gap-3 py-2">
      {Array.from({ length: rows }, (_, row) => (
        <div
          key={row}
          className="grid gap-4"
          style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
        >
          {Array.from({ length: columns }, (_, column) => (
            <Skeleton key={column} className="h-5" />
          ))}
        </div>
      ))}
    </div>
  );
}
