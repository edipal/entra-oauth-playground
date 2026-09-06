import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROVIDER_APP_ID,
  PROVIDER_APPS,
  getLegacyEntraRedirect,
  getProviderRoutePath,
  getProviderSwitchTarget,
  getRoutePathWithoutProvider,
  getRouteProvider,
  isProviderAppId,
  normalizePathname,
} from "@/lib/providerRegistry";

describe("isProviderAppId", () => {
  it("accepts the two supported workspaces", () => {
    expect(isProviderAppId("entra")).toBe(true);
    expect(isProviderAppId("auth0")).toBe(true);
  });

  it("rejects anything else, including the dropped Okta preset", () => {
    expect(isProviderAppId("okta")).toBe(false);
    expect(isProviderAppId("tools")).toBe(false);
    expect(isProviderAppId(undefined)).toBe(false);
  });
});

describe("normalizePathname", () => {
  it("adds a leading slash and drops a trailing one", () => {
    expect(normalizePathname("entra/")).toBe("/entra");
    expect(normalizePathname("/entra/")).toBe("/entra");
  });

  it("keeps the root path", () => {
    expect(normalizePathname("/")).toBe("/");
  });
});

describe("getRouteProvider", () => {
  it("reads the provider from an unprefixed path", () => {
    expect(getRouteProvider("/auth0/client-credentials")).toBe("auth0");
  });

  it("reads the provider from behind a locale segment", () => {
    expect(getRouteProvider("/de/entra/authorization-code/public-client")).toBe(
      "entra",
    );
  });

  it("returns null for shared routes", () => {
    expect(getRouteProvider("/tools/jwt-decoder")).toBeNull();
    expect(getRouteProvider("/en/tools/jwt-decoder")).toBeNull();
    expect(getRouteProvider("/")).toBeNull();
  });
});

describe("getRoutePathWithoutProvider", () => {
  it("strips provider and locale segments", () => {
    expect(
      getRoutePathWithoutProvider("/en/auth0/authorization-code/public-client"),
    ).toBe("/authorization-code/public-client");
  });

  it("returns the root suffix for a landing page", () => {
    expect(getRoutePathWithoutProvider("/entra")).toBe("/");
  });

  it("leaves non-provider paths untouched", () => {
    expect(getRoutePathWithoutProvider("/tools/jwt-decoder")).toBe(
      "/tools/jwt-decoder",
    );
  });
});

describe("getProviderRoutePath", () => {
  it("joins a provider base path with a flow suffix", () => {
    expect(getProviderRoutePath("auth0", "/client-credentials")).toBe(
      "/auth0/client-credentials",
    );
  });

  it("collapses the root suffix to the base path", () => {
    expect(getProviderRoutePath("entra", "/")).toBe("/entra");
  });
});

describe("getProviderSwitchTarget", () => {
  it("keeps the same flow when the target provider supports it", () => {
    expect(
      getProviderSwitchTarget(
        "/entra/authorization-code/confidential-client",
        "auth0",
      ),
    ).toBe("/auth0/authorization-code/confidential-client");
  });

  it("maps a landing page to the other landing page", () => {
    expect(getProviderSwitchTarget("/auth0", "entra")).toBe("/entra");
  });

  it("falls back to the landing page for an unsupported suffix", () => {
    expect(getProviderSwitchTarget("/entra/some-future-flow", "auth0")).toBe(
      "/auth0",
    );
  });

  it("stays put on shared tool routes", () => {
    expect(getProviderSwitchTarget("/tools/jwt-decoder", "auth0")).toBe(
      "/tools/jwt-decoder",
    );
  });

  it("sends non-provider routes to the target landing page", () => {
    expect(getProviderSwitchTarget("/", "auth0")).toBe("/auth0");
  });
});

describe("registry shape", () => {
  it("defaults to Entra", () => {
    expect(DEFAULT_PROVIDER_APP_ID).toBe("entra");
  });

  it("exposes the same three flows for both providers", () => {
    const flowIds = (provider: "entra" | "auth0") =>
      PROVIDER_APPS[provider].flows.map((flow) => flow.id).sort();

    expect(flowIds("entra")).toEqual([
      "authorization-code-confidential-client",
      "authorization-code-public-client",
      "client-credentials",
    ]);
    expect(flowIds("auth0")).toEqual(flowIds("entra"));
  });

  it("redirects legacy unprefixed flows into the Entra workspace", () => {
    expect(getLegacyEntraRedirect("/client-credentials")).toBe(
      "/entra/client-credentials",
    );
  });
});
