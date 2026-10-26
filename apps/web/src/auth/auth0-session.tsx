import { Auth0Provider, useAuth0 } from "@auth0/auth0-react";
import { useMemo } from "react";
import type { ReactNode } from "react";
import type { WebConfig } from "@/lib/web-config";
import { parseRoles } from "./roles";
import { SessionContext } from "./session";
import type { Session } from "./session";

function Bridge({ rolesClaim, children }: { rolesClaim: string; children: ReactNode }) {
  const { isLoading, isAuthenticated, user, loginWithRedirect, logout, getAccessTokenSilently } =
    useAuth0();

  const session = useMemo<Session>(
    () => ({
      status: isLoading ? "loading" : isAuthenticated ? "authenticated" : "anonymous",
      user: user
        ? {
            name: user.name ?? user.email ?? "Staff member",
            email: user.email ?? null,
            picture: user.picture ?? null,
          }
        : null,
      roles: parseRoles(user?.[rolesClaim]),
      signIn: () => void loginWithRedirect({ appState: { returnTo: window.location.pathname } }),
      signOut: () => void logout({ logoutParams: { returnTo: window.location.origin } }),
      getToken: async () => {
        const token = await getAccessTokenSilently();
        if (!token) throw new Error("No access token is available");
        return token;
      },
    }),
    [
      isLoading,
      isAuthenticated,
      user,
      rolesClaim,
      loginWithRedirect,
      logout,
      getAccessTokenSilently,
    ],
  );

  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function Auth0Session({ config, children }: { config: WebConfig; children: ReactNode }) {
  return (
    <Auth0Provider
      domain={config.auth0.domain}
      clientId={config.auth0.clientId}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: config.auth0.audience,
        scope: "openid profile email offline_access",
      }}
      useRefreshTokens
      cacheLocation="localstorage"
      onRedirectCallback={(appState) =>
        window.history.replaceState({}, document.title, appState?.returnTo ?? "/")
      }
    >
      <Bridge rolesClaim={config.auth0.rolesClaim}>{children}</Bridge>
    </Auth0Provider>
  );
}
