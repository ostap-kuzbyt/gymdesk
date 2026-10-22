import { BarbellHero } from "@/components/barbell-hero";
import { PlateMark } from "@/components/plate-mark";
import { Button } from "@/components/ui/button";

export function SignIn({ onSignIn }: { onSignIn: () => void }) {
  return (
    <main className="mx-auto grid min-h-screen max-w-6xl items-center gap-6 p-6 lg:grid-cols-2">
      <div className="flex max-w-md flex-col items-start gap-5">
        <span className="flex items-center gap-2 font-stamp text-2xl">
          <PlateMark />
          Gymdesk
        </span>
        <h1 className="text-5xl leading-none">Open the front desk</h1>
        <p className="text-lg text-muted-foreground">
          Members, workouts and reminders for your club in one place. Sign in with your staff
          account to continue.
        </p>
        <Button size="lg" className="h-11 px-6 text-base" onClick={onSignIn}>
          Sign in
        </Button>
      </div>
      <div className="h-80 sm:h-[26rem] lg:h-[34rem]">
        <BarbellHero />
      </div>
    </main>
  );
}
