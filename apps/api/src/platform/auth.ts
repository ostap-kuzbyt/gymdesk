import { role } from "@gymdesk/shared";
import type { Role } from "@gymdesk/shared";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { JWTVerifyGetKey } from "jose";
import type { Config } from "./config.js";
import { ForbiddenError, UnauthorizedError } from "./errors.js";

export interface AuthContext {
  subject: string;
  roles: Role[];
}

export type TokenVerifier = (token: string) => Promise<AuthContext>;

export interface VerifierOptions {
  keys: JWTVerifyGetKey;
  issuer: string;
  audience: string;
  rolesClaim: string;
}

declare module "fastify" {
  interface FastifyRequest {
    auth: AuthContext | undefined;
  }
}

export function createTokenVerifier(options: VerifierOptions): TokenVerifier {
  return async (token) => {
    const { payload } = await jwtVerify(token, options.keys, {
      issuer: options.issuer,
      audience: options.audience,
    });
    if (!payload.sub) throw new Error("Token has no subject");

    const claim = payload[options.rolesClaim];
    const roles = Array.isArray(claim)
      ? claim.flatMap((value) => {
          const parsed = role.safeParse(value);
          return parsed.success ? [parsed.data] : [];
        })
      : [];

    return { subject: payload.sub, roles };
  };
}

export function createAuth0Verifier(config: Config): TokenVerifier {
  return createTokenVerifier({
    keys: createRemoteJWKSet(new URL(`https://${config.AUTH0_DOMAIN}/.well-known/jwks.json`)),
    issuer: `https://${config.AUTH0_DOMAIN}/`,
    audience: config.AUTH0_AUDIENCE,
    rolesClaim: config.AUTH0_ROLES_CLAIM,
  });
}

export type RoleGuard = (...allowed: Role[]) => (request: FastifyRequest) => Promise<void>;

export function registerAuth(app: FastifyInstance, verify: TokenVerifier): RoleGuard {
  app.decorateRequest("auth", undefined);

  return (...allowed) =>
    async (request) => {
      const header = request.headers.authorization;
      if (!header?.startsWith("Bearer ")) {
        throw new UnauthorizedError("A bearer token is required");
      }

      let auth: AuthContext;
      try {
        auth = await verify(header.slice("Bearer ".length));
      } catch {
        throw new UnauthorizedError("The token is invalid or has expired");
      }

      if (!auth.roles.some((granted) => allowed.includes(granted))) {
        throw new ForbiddenError("Your role is not allowed to do this");
      }
      request.auth = auth;
    };
}
