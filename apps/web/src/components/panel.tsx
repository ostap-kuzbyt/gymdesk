import type { ReactNode } from "react";

interface PanelProps {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}

export function Panel({ title, action, children }: PanelProps) {
  return (
    <section className="rounded-md border border-border bg-card">
      <div className="flex items-baseline justify-between gap-3 border-b border-border px-4 py-3">
        <h2>{title}</h2>
        {action}
      </div>
      <div className="px-4 py-1">{children}</div>
    </section>
  );
}
