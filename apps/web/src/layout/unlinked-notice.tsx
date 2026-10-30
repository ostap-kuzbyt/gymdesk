import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function UnlinkedNotice({ subject }: { subject: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(subject);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section
      role="status"
      className="mb-6 flex flex-col gap-4 rounded-md border border-l-8 border-border border-l-plate-yellow bg-card px-5 py-4"
    >
      <div className="flex flex-col gap-1">
        <h2>Your account is not linked to a coach profile</h2>
        <p className="max-w-2xl text-muted-foreground">
          An admin has to connect it to your coach profile first. Until then your schedule and
          member list stay empty.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Send this account ID to an admin</span>
        <div className="flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-muted px-3 py-2 font-mono text-sm select-all sm:max-w-md">
            {subject}
          </code>
          <Button variant="outline" onClick={() => void copy()}>
            {copied ? <Check /> : <Copy />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>
    </section>
  );
}
