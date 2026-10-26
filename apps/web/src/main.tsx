import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { Auth0Session } from "@/auth/auth0-session";
import { ThemeProvider } from "@/components/theme-provider";
import { ApiProvider } from "@/lib/api-context";
import { createQueryClient } from "@/lib/query-client";
import { readWebConfig } from "@/lib/web-config";
import { SetupNeeded } from "@/screens/setup-needed";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("The page has no #root element");

const queryClient = createQueryClient();
const configuration = readWebConfig(import.meta.env);

createRoot(root).render(
  <StrictMode>
    <ThemeProvider>
      {configuration.ok ? (
        <Auth0Session config={configuration.config}>
          <QueryClientProvider client={queryClient}>
            <ApiProvider baseUrl={configuration.config.apiUrl}>
              <App />
            </ApiProvider>
          </QueryClientProvider>
        </Auth0Session>
      ) : (
        <SetupNeeded missing={configuration.missing} />
      )}
    </ThemeProvider>
  </StrictMode>,
);
