import { useSession } from "@/auth/session";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Loading } from "@/screens/loading";
import { SignIn } from "@/screens/sign-in";

export function App() {
  const session = useSession();

  if (session.status === "loading") return <Loading />;
  if (session.status === "anonymous") return <SignIn onSignIn={session.signIn} />;

  return (
    <div className="min-h-screen">
      <header className="flex h-14 items-center justify-between border-b border-border bg-card px-6">
        <span className="font-stamp text-xl">Gymdesk</span>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="outline" size="sm" onClick={session.signOut}>
            Sign out
          </Button>
        </div>
      </header>
      <main className="flex flex-col items-start gap-2 p-6">
        <h1>Today</h1>
        <p className="text-muted-foreground">
          Signed in as {session.user?.name}
          {session.roles.length > 0 ? ` (${session.roles.join(", ")})` : ""}
        </p>
      </main>
    </div>
  );
}
