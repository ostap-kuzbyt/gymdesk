import { Outlet, useRouterState } from "@tanstack/react-router";
import { useSession } from "@/auth/session";
import { Toaster } from "@/components/ui/sonner";
import { canOpen } from "@/nav";
import { CommandPaletteProvider } from "@/palette/palette-context";
import { NoAccess } from "@/pages/no-access";
import { TopBar } from "./top-bar";

export function AppLayout() {
  const { roles } = useSession();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <CommandPaletteProvider>
      <div className="min-h-screen">
        <TopBar />
        <main className="mx-auto w-full max-w-7xl p-4 sm:p-6">
          {canOpen(roles, pathname) ? <Outlet /> : <NoAccess roles={roles} />}
        </main>
      </div>
      <Toaster position="bottom-right" />
    </CommandPaletteProvider>
  );
}
