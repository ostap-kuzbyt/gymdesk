import { describe, expect, it } from "vitest";
import { readWebConfig } from "./web-config";

const complete = {
  VITE_AUTH0_DOMAIN: "club.eu.auth0.com",
  VITE_AUTH0_CLIENT_ID: "abc123",
  VITE_AUTH0_AUDIENCE: "https://api.gymdesk",
};

describe("readWebConfig", () => {
  it("reads the Auth0 settings and defaults the roles claim and api address", () => {
    expect(readWebConfig(complete)).toEqual({
      ok: true,
      config: {
        apiUrl: "",
        auth0: {
          domain: "club.eu.auth0.com",
          clientId: "abc123",
          audience: "https://api.gymdesk",
          rolesClaim: "https://gymdesk/roles",
        },
      },
    });
  });

  it("removes trailing slashes from the api address", () => {
    const result = readWebConfig({ ...complete, VITE_API_URL: "https://api.club.test//" });

    expect(result.ok && result.config.apiUrl).toBe("https://api.club.test");
  });

  it("lists every missing variable once", () => {
    expect(readWebConfig({})).toEqual({
      ok: false,
      missing: ["VITE_AUTH0_DOMAIN", "VITE_AUTH0_CLIENT_ID", "VITE_AUTH0_AUDIENCE"],
    });
  });

  it("treats blank values as missing", () => {
    expect(readWebConfig({ ...complete, VITE_AUTH0_CLIENT_ID: "  " })).toEqual({
      ok: false,
      missing: ["VITE_AUTH0_CLIENT_ID"],
    });
  });
});
