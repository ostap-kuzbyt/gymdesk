import { Button } from "@/components/ui/button";
import { FullScreenMessage } from "./full-screen-message";

export function SignIn({ onSignIn }: { onSignIn: () => void }) {
  return (
    <FullScreenMessage title="Open the front desk">
      <p className="text-muted-foreground">Sign in with your staff account to continue.</p>
      <Button size="lg" onClick={onSignIn}>
        Sign in
      </Button>
    </FullScreenMessage>
  );
}
