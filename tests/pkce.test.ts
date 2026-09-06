import { describe, expect, it } from "vitest";
import {
  base64UrlEncode,
  computeS256Challenge,
  randomCodeVerifier,
} from "@/lib/pkce";

// PKCE had no unit coverage at all. The only assertion anywhere was an offline
// check that the verifier matched /^[A-Za-z0-9_-]{43}$/ — which a challenge
// function returning its own input, or a constant, would also satisfy. The
// vector below is the one thing that cannot be faked.

// RFC 7636 Appendix B, the worked example the specification publishes.
const RFC_7636_VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const RFC_7636_CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

// RFC 7636 §4.1: 43 to 128 characters from the unreserved set.
const UNRESERVED = /^[A-Za-z0-9\-._~]+$/;

describe("computeS256Challenge", () => {
  it("matches the challenge RFC 7636 publishes for its own verifier", async () => {
    expect(await computeS256Challenge(RFC_7636_VERIFIER)).toBe(
      RFC_7636_CHALLENGE,
    );
  });

  it("is base64url, so it survives a query string unescaped", async () => {
    const challenge = await computeS256Challenge(randomCodeVerifier());

    expect(challenge).not.toContain("+");
    expect(challenge).not.toContain("/");
    expect(challenge).not.toContain("=");
    // SHA-256 is 32 bytes, which is 43 base64 characters without padding
    expect(challenge).toHaveLength(43);
  });

  it("is not the verifier, and changes when the verifier does", async () => {
    const verifier = randomCodeVerifier();
    const challenge = await computeS256Challenge(verifier);

    expect(challenge).not.toBe(verifier);
    expect(await computeS256Challenge(`${verifier}x`)).not.toBe(challenge);
  });
});

describe("randomCodeVerifier", () => {
  it("stays inside the length RFC 7636 allows", () => {
    // The default is 96. Nothing asserted it was legal before.
    expect(randomCodeVerifier().length).toBeGreaterThanOrEqual(43);
    expect(randomCodeVerifier().length).toBeLessThanOrEqual(128);
    expect(randomCodeVerifier(43)).toHaveLength(43);
    expect(randomCodeVerifier(128)).toHaveLength(128);
  });

  it("uses only the unreserved characters the specification names", () => {
    // Sampled rather than argued: the charset is applied through a modulo, so a
    // single draw would not exercise the whole alphabet.
    for (let attempt = 0; attempt < 50; attempt += 1) {
      expect(randomCodeVerifier()).toMatch(UNRESERVED);
    }
  });

  it("does not repeat itself", () => {
    const seen = new Set(
      Array.from({ length: 100 }, () => randomCodeVerifier()),
    );

    expect(seen.size).toBe(100);
  });
});

describe("base64UrlEncode", () => {
  it("encodes known bytes the way base64url specifies", () => {
    // 0xFB 0xFF exercises exactly the two characters base64url replaces: standard
    // base64 gives "+/8=" here.
    const bytes = new Uint8Array([0xfb, 0xff]).buffer;

    expect(base64UrlEncode(bytes)).toBe("-_8");
  });

  it("never emits a character that would need escaping in a URL", () => {
    const bytes = new Uint8Array(256);
    for (let i = 0; i < 256; i += 1) bytes[i] = i;

    const encoded = base64UrlEncode(bytes.buffer);
    expect(encoded).toMatch(/^[A-Za-z0-9\-_]+$/);
  });
});
