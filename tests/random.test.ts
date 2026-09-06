import { afterEach, describe, expect, it } from "vitest";
import { randomBytes, randomGuidLike, randomUrlSafeString } from "@/lib/random";

// The RNG behind `state`, `nonce` and the client assertion's `jti` had no tests.
// The refusal to fall back to an insecure source — the point of commit beb4b81 —
// was protected by nothing at all.

const URL_SAFE = /^[A-Za-z0-9\-_]+$/;
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const realCrypto = globalThis.crypto;

afterEach(() => {
  Object.defineProperty(globalThis, "crypto", {
    value: realCrypto,
    configurable: true,
    writable: true,
  });
});

describe("randomBytes", () => {
  it("fills the requested number of bytes", () => {
    expect(randomBytes(32)).toHaveLength(32);
    expect(randomBytes(0)).toHaveLength(0);
  });

  it("throws rather than falling back to an insecure source", () => {
    // The deliberate behaviour: a missing Web Crypto must stop the caller, not
    // quietly hand back predictable bytes that end up in a `state` or a `jti`.
    Object.defineProperty(globalThis, "crypto", {
      value: undefined,
      configurable: true,
      writable: true,
    });

    expect(() => randomBytes(16)).toThrow(/Secure random not available/);
  });

  it("throws when crypto exists but cannot generate", () => {
    Object.defineProperty(globalThis, "crypto", {
      value: {},
      configurable: true,
      writable: true,
    });

    expect(() => randomBytes(16)).toThrow(/Secure random not available/);
  });
});

describe("randomUrlSafeString", () => {
  it("has the requested length, defaulting to 32", () => {
    expect(randomUrlSafeString()).toHaveLength(32);
    expect(randomUrlSafeString(1)).toHaveLength(1);
    expect(randomUrlSafeString(64)).toHaveLength(64);
  });

  it("stays URL-safe, so a state parameter needs no escaping", () => {
    // The alphabet is 64 characters and a byte is 256 values, so the modulo here
    // is unbiased. randomCodeVerifier's 66-character set is not — noted rather
    // than asserted, since neither is a defect at these lengths.
    for (let attempt = 0; attempt < 50; attempt += 1) {
      expect(randomUrlSafeString()).toMatch(URL_SAFE);
    }
  });

  it("does not repeat itself", () => {
    const seen = new Set(
      Array.from({ length: 100 }, () => randomUrlSafeString()),
    );

    expect(seen.size).toBe(100);
  });
});

describe("randomGuidLike", () => {
  it("is a syntactically valid version 4 UUID", () => {
    // The version and variant nibbles are forced, so this asserts the masking
    // actually happened rather than that the shape looks about right.
    for (let attempt = 0; attempt < 50; attempt += 1) {
      expect(randomGuidLike()).toMatch(UUID_V4);
    }
  });

  it("gives every assertion its own jti", () => {
    const seen = new Set(Array.from({ length: 100 }, () => randomGuidLike()));

    expect(seen.size).toBe(100);
  });
});
