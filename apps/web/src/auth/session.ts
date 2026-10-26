import { createContext, useContext } from "react";
import type { Role } from "@gymdesk/shared";

export interface SessionUser {
  name: string;
  email: string | null;
  picture: string | null;
}

export interface Session {
  status: "loading" | "anonymous" | "authenticated";
  user: SessionUser | null;
  roles: Role[];
  signIn: () => void;
  signOut: () => void;
  getToken: () => Promise<string>;
}

export const SessionContext = createContext<Session | null>(null);

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession must be used inside a session provider");
  return session;
}
