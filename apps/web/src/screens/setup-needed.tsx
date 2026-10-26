import { FullScreenMessage } from "./full-screen-message";

export function SetupNeeded({ missing }: { missing: string[] }) {
  return (
    <FullScreenMessage title="Connect Gymdesk to Auth0">
      <p className="text-muted-foreground">
        Add these variables to <code className="font-medium">apps/web/.env</code> and restart the
        dev server.
      </p>
      <ul className="flex flex-col gap-1">
        {missing.map((name) => (
          <li key={name}>
            <code className="font-medium">{name}</code>
          </li>
        ))}
      </ul>
    </FullScreenMessage>
  );
}
