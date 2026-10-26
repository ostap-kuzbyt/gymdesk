import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import { useSession } from "@/auth/session";
import { createApiClient } from "./api";
import type { ApiClient } from "./api";

const ApiContext = createContext<ApiClient | null>(null);

export function ApiProvider({ baseUrl, children }: { baseUrl: string; children: ReactNode }) {
  const { getToken, signIn } = useSession();

  const client = useMemo(
    () => createApiClient({ baseUrl, getToken, onUnauthorized: signIn }),
    [baseUrl, getToken, signIn],
  );

  return <ApiContext.Provider value={client}>{children}</ApiContext.Provider>;
}

export function useApi(): ApiClient {
  const client = useContext(ApiContext);
  if (!client) throw new Error("useApi must be used inside an ApiProvider");
  return client;
}
