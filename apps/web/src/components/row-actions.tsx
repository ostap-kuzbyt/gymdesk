import { Archive, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RowActions({ onEdit, onArchive }: { onEdit: () => void; onArchive: () => void }) {
  return (
    <div className="flex justify-end gap-1.5">
      <Button variant="outline" size="sm" onClick={onEdit}>
        <Pencil className="sm:hidden" />
        <span className="sr-only sm:not-sr-only">Edit</span>
      </Button>
      <Button variant="outline" size="sm" onClick={onArchive}>
        <Archive className="sm:hidden" />
        <span className="sr-only sm:not-sr-only">Archive</span>
      </Button>
    </div>
  );
}
