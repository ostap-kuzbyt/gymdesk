import type { ReactNode } from "react";

export function FullScreenMessage({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <div className="flex w-full max-w-md flex-col items-start gap-4">
        <span className="font-stamp text-xl">Gymdesk</span>
        <h1>{title}</h1>
        {children}
      </div>
    </main>
  );
}
