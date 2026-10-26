import { FullScreenMessage } from "./full-screen-message";

export function Loading() {
  return (
    <FullScreenMessage title="Opening the front desk">
      <p className="text-muted-foreground" role="status">
        Checking your session…
      </p>
    </FullScreenMessage>
  );
}
