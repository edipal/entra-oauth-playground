import { describe, expect, it } from "vitest";
import { errors } from "jose";
import { describeFailure } from "@/lib/jwtVerify";

// `describeFailure` keys off jose's error codes, which is the whole point of it:
// the previous version searched the error *message* for "key" or "kid", which put
// an expired token — whose message mentions neither — in the same bucket as a
// missing signing key.
//
// The codes are read from jose's own error classes rather than repeated as string
// literals. A typo, or a jose release that renames one, breaks neither the build
// nor any other test: the code would just fall through to the default and every
// failure would read "Verification failed" alike. Pinning them here is what makes
// that visible.

describe("describeFailure", () => {
  it("reports a JWKS that holds no key for this token", () => {
    expect(describeFailure(errors.JWKSNoMatchingKey.code)).toEqual({
      keyFound: false,
      reason: "No matching key in the JWKS",
    });
  });

  it("reports a JWKS that could not be read at all", () => {
    for (const code of [errors.JWKSTimeout.code, errors.JWKSInvalid.code]) {
      expect(describeFailure(code)).toEqual({
        keyFound: false,
        reason: "Could not fetch the JWKS",
      });
    }
  });

  it("says the key was found when the signature is the thing that failed", () => {
    // The distinction the Validate step draws: "fetch JWKS, find key" ticks green
    // and "verify signature" does not, which is a different diagnosis from a kid
    // that is not published at all.
    expect(describeFailure(errors.JWSSignatureVerificationFailed.code)).toEqual(
      {
        keyFound: true,
        reason: "Signature does not match the key",
      },
    );
  });

  it("says the key was found when only the algorithm was refused", () => {
    // verifyJwtSignature accepts RS256/384/512. A token signed with anything else
    // is not a missing-key problem.
    expect(describeFailure(errors.JOSEAlgNotAllowed.code)).toEqual({
      keyFound: true,
      reason: "Signing algorithm is not accepted",
    });
  });

  it("counts several matching keys as found, not missing", () => {
    // jose refuses to guess between them. The key is there; what is missing is a
    // `kid` narrow enough to pick it out — the opposite diagnosis from
    // JWKSNoMatchingKey, and previously indistinguishable from it because this
    // code fell through to the default.
    expect(describeFailure(errors.JWKSMultipleMatchingKeys.code)).toEqual({
      keyFound: true,
      reason: "More than one key in the JWKS matches this token",
    });
  });

  it("reports a token that is not a well-formed JWT", () => {
    for (const code of [errors.JWSInvalid.code, errors.JWTInvalid.code]) {
      expect(describeFailure(code)).toEqual({
        keyFound: false,
        reason: "Invalid JWT format",
      });
    }
  });

  it("falls back for a code it does not know, including none at all", () => {
    const fallback = { keyFound: false, reason: "Verification failed" };
    expect(describeFailure(undefined)).toEqual(fallback);
    expect(describeFailure("ERR_SOMETHING_JOSE_ADDED_LATER")).toEqual(fallback);
    // and an expired token, which this function deliberately does not classify —
    // verifyJwtSignature checks the signature only, leaving `exp` to the claim
    // list that allows clock skew.
    expect(describeFailure(errors.JWTExpired.code)).toEqual(fallback);
  });
});
