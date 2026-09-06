import { describe, expect, it } from "vitest";
import {
  isNamespacedClaim,
  parsePayloadToClaims,
  resolveClaimDescriptions,
  type ClaimDescriptionGroups,
} from "@/lib/jwtClaims";
import de from "@/messages/de.json";
import en from "@/messages/en.json";

const FALLBACK = "unknown-claim";
const NAMESPACED = "namespaced-claim";

const groups = (locale: typeof en | typeof de) =>
  locale.StepDecode.claimDescriptions as ClaimDescriptionGroups;

describe("resolveClaimDescriptions", () => {
  it("merges the shared layer with the provider overlay", () => {
    const resolved = resolveClaimDescriptions(
      {
        common: { iss: "shared issuer", aud: "shared audience" },
        auth0: { aud: "auth0 audience", gty: "grant type" },
      },
      "auth0",
    );

    expect(resolved).toEqual({
      iss: "shared issuer",
      aud: "auth0 audience",
      gty: "grant type",
    });
  });

  it("returns only the shared layer when the provider has no overlay", () => {
    expect(
      resolveClaimDescriptions({ common: { iss: "shared issuer" } }, "entra"),
    ).toEqual({ iss: "shared issuer" });
  });

  it("tolerates an empty group object", () => {
    expect(resolveClaimDescriptions({}, "entra")).toEqual({});
  });
});

describe("message catalogue wiring", () => {
  it.each([
    ["en", en],
    ["de", de],
  ])("describes Auth0-specific claims in %s", (_locale, messages) => {
    const auth0 = resolveClaimDescriptions(groups(messages), "auth0");

    for (const claim of [
      "scope",
      "permissions",
      "gty",
      "client_id",
      "org_id",
      "org_name",
    ]) {
      expect(auth0[claim]).toBeTruthy();
    }
  });

  it.each([
    ["en", en],
    ["de", de],
  ])(
    "keeps Entra-only claims out of the Auth0 dictionary in %s",
    (_locale, messages) => {
      const auth0 = resolveClaimDescriptions(groups(messages), "auth0");
      const entra = resolveClaimDescriptions(groups(messages), "entra");

      for (const claim of ["tid", "wids", "scp", "xms_cc", "appidacr"]) {
        expect(entra[claim]).toBeTruthy();
        expect(auth0[claim]).toBeUndefined();
      }
    },
  );

  it.each([
    ["en", en],
    ["de", de],
  ])("gives both providers the standard claims in %s", (_locale, messages) => {
    for (const provider of ["entra", "auth0"] as const) {
      const resolved = resolveClaimDescriptions(groups(messages), provider);
      for (const claim of [
        "iss",
        "sub",
        "aud",
        "exp",
        "iat",
        "nbf",
        "jti",
        "cnf",
      ]) {
        expect(resolved[claim]).toBeTruthy();
      }
    }
  });

  it("keeps English and German dictionaries at the same size per provider", () => {
    for (const provider of ["entra", "auth0"] as const) {
      expect(
        Object.keys(resolveClaimDescriptions(groups(en), provider)),
      ).toEqual(Object.keys(resolveClaimDescriptions(groups(de), provider)));
    }
  });
});

describe("isNamespacedClaim", () => {
  it("matches URI-namespaced claim names", () => {
    expect(isNamespacedClaim("https://acme.example/roles")).toBe(true);
    expect(isNamespacedClaim("http://schemas.example/claim")).toBe(true);
  });

  it("does not match ordinary claim names", () => {
    expect(isNamespacedClaim("permissions")).toBe(false);
    expect(isNamespacedClaim("org_id")).toBe(false);
  });
});

describe("parsePayloadToClaims", () => {
  const descriptions = { iss: "issuer", permissions: "auth0 permissions" };

  it("returns nothing for blank or non-object payloads", () => {
    expect(parsePayloadToClaims("", descriptions, FALLBACK)).toEqual([]);
    expect(parsePayloadToClaims("[1,2]", descriptions, FALLBACK)).toEqual([]);
    expect(parsePayloadToClaims("not json", descriptions, FALLBACK)).toEqual(
      [],
    );
    expect(parsePayloadToClaims("null", descriptions, FALLBACK)).toEqual([]);
  });

  it("describes known claims and falls back for unknown ones", () => {
    const rows = parsePayloadToClaims(
      JSON.stringify({ iss: "https://x", mystery: 1 }),
      descriptions,
      FALLBACK,
    );

    expect(rows).toEqual([
      { name: "iss", value: "https://x", description: "issuer" },
      { name: "mystery", value: "1", description: FALLBACK },
    ]);
  });

  it("uses the namespaced description for URI claim names", () => {
    const rows = parsePayloadToClaims(
      JSON.stringify({ "https://acme.example/roles": ["admin"] }),
      descriptions,
      FALLBACK,
      NAMESPACED,
    );

    expect(rows[0].description).toBe(NAMESPACED);
    expect(rows[0].value).toBe('[\n  "admin"\n]');
  });

  it("still falls back when no namespaced description is supplied", () => {
    const rows = parsePayloadToClaims(
      JSON.stringify({ "https://acme.example/roles": ["admin"] }),
      descriptions,
      FALLBACK,
    );

    expect(rows[0].description).toBe(FALLBACK);
  });

  it("formats non-string values readably", () => {
    const rows = parsePayloadToClaims(
      JSON.stringify({ exp: 1700000000, active: true, missing: null }),
      {},
      FALLBACK,
    );

    expect(rows.map((row) => row.value)).toEqual(["1700000000", "true", ""]);
  });
});
