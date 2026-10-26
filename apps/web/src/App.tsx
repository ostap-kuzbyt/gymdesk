import { PlateBadge } from "@/components/plate-badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export function App() {
  return (
    <div className="min-h-screen">
      <header className="flex h-14 items-center justify-between border-b border-border bg-card px-6">
        <span className="font-stamp text-xl">Gymdesk</span>
        <ThemeToggle />
      </header>
      <main className="flex flex-col items-start gap-6 p-6">
        <h1>Today</h1>
        <div className="flex items-center gap-3">
          <PlateBadge tone="green" value="23" label="23 days left" />
          <PlateBadge tone="yellow" value="4" label="4 days left" />
          <PlateBadge tone="blue" value="2" label="Starts in 2 days" />
          <PlateBadge tone="red" value="0" label="Expired" />
        </div>
        <Button>Check in</Button>
      </main>
    </div>
  );
}
