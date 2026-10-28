import { Search } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { useMemberSearch } from "./api";
import { ActiveUntil } from "./subscription-plate";

interface MemberPickerProps {
  actionLabel: string;
  disabledIds: ReadonlySet<string>;
  disabledLabel: string;
  pending: boolean;
  onPick: (member: { id: string; fullName: string }) => void;
}

export function MemberPicker({
  actionLabel,
  disabledIds,
  disabledLabel,
  pending,
  onPick,
}: MemberPickerProps) {
  const [text, setText] = useState("");
  const term = useDebouncedValue(text.trim(), 250);
  const searching = term.length >= 2;
  const results = useMemberSearch({ q: term, offset: 0, limit: 6 });

  return (
    <div className="flex max-w-xl flex-col gap-3">
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Find a member by name, email or phone"
          aria-label="Find a member"
          className="pl-8"
        />
      </div>
      {searching && results.data ? (
        results.data.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nobody matches "{term}".</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {results.data.items.map((member) => (
              <li key={member.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <div className="truncate font-medium">{member.fullName}</div>
                  <div className="text-xs text-muted-foreground">
                    <ActiveUntil activeUntil={member.activeUntil} />
                  </div>
                </div>
                {disabledIds.has(member.id) ? (
                  <span className="text-sm text-muted-foreground">{disabledLabel}</span>
                ) : (
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() => onPick({ id: member.id, fullName: member.fullName })}
                    aria-label={`${actionLabel} ${member.fullName}`}
                  >
                    {actionLabel}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}
