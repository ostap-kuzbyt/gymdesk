import { Link } from "@tanstack/react-router";
import { ChevronDown, LogOut, Menu } from "lucide-react";
import { useState } from "react";
import { useSession } from "@/auth/session";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { ROLE_LABELS, navFor } from "@/nav";

const tabClass =
  "relative flex h-14 items-center px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2";
const activeTabClass =
  "text-foreground after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-primary";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (
    (parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")
  ).toUpperCase();
}

function UserMenu() {
  const { user, roles, signOut } = useSession();
  const name = user?.name ?? "Staff member";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="gap-2 px-2" aria-label="Account menu">
          <span
            aria-hidden
            className="grid size-6 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-foreground"
          >
            {initialsOf(name)}
          </span>
          <span className="hidden max-w-32 truncate sm:inline">{name}</span>
          <ChevronDown className="hidden sm:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate text-foreground">{name}</span>
          {user?.email ? (
            <span className="truncate text-xs font-normal text-muted-foreground">{user.email}</span>
          ) : null}
          <span className="text-xs font-normal text-muted-foreground">
            {roles.length > 0 ? roles.map((item) => ROLE_LABELS[item]).join(", ") : "No role"}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={signOut}>
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ClubMenu({ items }: { items: ReturnType<typeof navFor> }) {
  if (items.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={cn(tabClass, "gap-1 outline-ring/50")}>
          Club
          <ChevronDown className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {items.map((item) => (
          <DropdownMenuItem key={item.id} asChild>
            <Link to={item.to}>{item.label}</Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MobileNav() {
  const { roles } = useSession();
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64">
        <SheetHeader>
          <SheetTitle className="font-stamp text-xl">Gymdesk</SheetTitle>
        </SheetHeader>
        <nav aria-label="Pages" className="flex flex-col px-2 pb-4">
          {navFor(roles).map((item) => (
            <Link
              key={item.id}
              to={item.to}
              activeOptions={{ exact: item.to === "/" }}
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2.5 text-base font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              activeProps={{ className: "bg-accent text-accent-foreground" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

export function TopBar() {
  const { roles } = useSession();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-card px-3 sm:px-6">
      <MobileNav />
      <Link to="/" className="mr-4 font-stamp text-xl">
        Gymdesk
      </Link>
      <nav aria-label="Pages" className="hidden h-full md:flex">
        {navFor(roles, "main").map((item) => (
          <Link
            key={item.id}
            to={item.to}
            activeOptions={{ exact: item.to === "/" }}
            className={tabClass}
            activeProps={{ className: activeTabClass }}
          >
            {item.label}
          </Link>
        ))}
        <ClubMenu items={navFor(roles, "club")} />
      </nav>
      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
