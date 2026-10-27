import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { WebConfig } from "./web-config";

const ConfigContext = createContext<WebConfig | null>(null);

export function ConfigProvider({ config, children }: { config: WebConfig; children: ReactNode }) {
  return <ConfigContext.Provider value={config}>{children}</ConfigContext.Provider>;
}

export function useCurrency(): string {
  return useContext(ConfigContext)?.currency ?? "UAH";
}
