import { memberPage } from "@gymdesk/shared";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { LogIn, Monitor, Moon, Sun, UserRound } from "lucide-react";
import { useState } from "react";
import { useSession } from "@/auth/session";
import { useTheme } from "@/components/theme-provider";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useCheckIn } from "@/features/use-check-in";
import { useApi } from "@/lib/api-context";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { canCheckIn } from "@/lib/permissions";
import { navFor } from "@/nav";
import { matchesQuery } from "./matches";

const MIN_SEARCH_LENGTH = 2;
const RESULT_LIMIT = 5;
const THEME_ICONS = { system: Monitor, light: Sun, dark: Moon } as const;

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const [query, setQuery] = useState("");

  function changeOpen(next: boolean) {
    if (!next) setQuery("");
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="top-1/3 translate-y-0 overflow-hidden p-0" showCloseButton={false}>
        <DialogTitle className="sr-only">Search or jump to</DialogTitle>
        <DialogDescription className="sr-only">
          Find a member, check someone in or open a page.
        </DialogDescription>
        <PaletteBody query={query} onQueryChange={setQuery} close={() => changeOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function PaletteBody({
  query,
  onQueryChange,
  close,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  close: () => void;
}) {
  const api = useApi();
  const navigate = useNavigate();
  const { roles } = useSession();
  const { preference, cycle } = useTheme();
  const { checkIn } = useCheckIn();

  const term = useDebouncedValue(query.trim(), 200);
  const searching = term.length >= MIN_SEARCH_LENGTH;
  const members = useQuery({
    queryKey: ["members", "palette", term],
    queryFn: () => api.get(memberPage, "/api/members", { q: term, limit: RESULT_LIMIT }),
    enabled: searching,
  });

  const pages = navFor(roles).filter((item) => matchesQuery(item.label, query));
  const found = searching ? (members.data?.items ?? []) : [];
  const ThemeIcon = THEME_ICONS[preference];
  const showTheme = matchesQuery("theme appearance dark light", query);

  return (
    <Command shouldFilter={false} loop>
      <CommandInput
        value={query}
        onValueChange={onQueryChange}
        placeholder="Type a member's name or a page"
      />
      <CommandList>
        <CommandEmpty>
          {members.isFetching ? "Searching…" : "Nothing matches. Try a member's name or email."}
        </CommandEmpty>

        {found.length > 0 && canCheckIn(roles) ? (
          <CommandGroup heading="Check in">
            {found.map((member) => (
              <CommandItem
                key={`check-in-${member.id}`}
                value={`check-in-${member.id}`}
                onSelect={() => {
                  close();
                  checkIn({ id: member.id, name: member.fullName });
                }}
              >
                <LogIn />
                <span className="shrink-0">{member.fullName}</span>
                <span className="ml-auto truncate text-xs text-muted-foreground">
                  {member.email}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {found.length > 0 ? (
          <CommandGroup heading="Open profile">
            {found.map((member) => (
              <CommandItem
                key={`profile-${member.id}`}
                value={`profile-${member.id}`}
                onSelect={() => {
                  close();
                  void navigate({ to: "/members/$memberId", params: { memberId: member.id } });
                }}
              >
                <UserRound />
                <span className="shrink-0">{member.fullName}</span>
                <span className="ml-auto truncate text-xs text-muted-foreground">
                  {member.email}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {pages.length > 0 ? (
          <CommandGroup heading="Go to">
            {pages.map((item) => (
              <CommandItem
                key={item.id}
                value={`page-${item.id}`}
                onSelect={() => {
                  close();
                  void navigate({ to: item.to });
                }}
              >
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {showTheme ? (
          <CommandGroup heading="Appearance">
            <CommandItem value="theme" onSelect={cycle}>
              <ThemeIcon />
              Theme: {preference}. Switch
            </CommandItem>
          </CommandGroup>
        ) : null}
      </CommandList>
    </Command>
  );
}
