import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { render } from "@testing-library/react";
import type { Role } from "@gymdesk/shared";
import { vi } from "vitest";
import { SessionContext } from "@/auth/session";
import type { Session } from "@/auth/session";
import { ThemeProvider } from "@/components/theme-provider";
import { ApiProvider } from "@/lib/api-context";
import { createAppRouter } from "@/router";

export interface RenderOptions {
  roles?: Role[];
  path?: string;
  name?: string;
  email?: string;
  fetch?: typeof fetch;
}

export function renderApp({
  roles = ["admin"],
  path = "/",
  name = "Olena Shevchenko",
  email = "olena@club.test",
  fetch: fetchStub,
}: RenderOptions = {}) {
  if (fetchStub) vi.stubGlobal("fetch", fetchStub);
  const session: Session = {
    status: "authenticated",
    user: { name, email, picture: null },
    roles,
    signIn: vi.fn(),
    signOut: vi.fn(),
    getToken: async () => "test-token",
  };
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }));

  const view = render(
    <ThemeProvider>
      <SessionContext.Provider value={session}>
        <QueryClientProvider
          client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
        >
          <ApiProvider baseUrl="">
            <RouterProvider router={router} />
          </ApiProvider>
        </QueryClientProvider>
      </SessionContext.Provider>
    </ThemeProvider>,
  );
  return { ...view, session, router };
}
