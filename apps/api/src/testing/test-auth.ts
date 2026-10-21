import type { Role } from "@gymdesk/shared";
import { generateKeyPair, SignJWT } from "jose";
import { createTokenVerifier } from "../platform/auth.js";
import type { TokenVerifier } from "../platform/auth.js";
import { testAuth } from "./test-config.js";

export interface TestAuth {
  verifier: TokenVerifier;
  bearer: (roles: Role[], subject?: string) => Promise<{ authorization: string }>;
}

export async function createTestAuth(): Promise<TestAuth> {
  const { publicKey, privateKey } = await generateKeyPair("RS256");

  return {
    verifier: createTokenVerifier({ ...testAuth, keys: async () => publicKey }),
    bearer: async (roles, subject = "auth0|tester") => {
      const token = await new SignJWT({ [testAuth.rolesClaim]: roles })
        .setProtectedHeader({ alg: "RS256" })
        .setSubject(subject)
        .setIssuer(testAuth.issuer)
        .setAudience(testAuth.audience)
        .setExpirationTime("5m")
        .sign(privateKey);
      return { authorization: `Bearer ${token}` };
    },
  };
}
