import { describe, expect, it } from "vitest";
import { decodeJwt } from "@/lib/jwtDecode";

const base64url = (value: object) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");

const signedJwt = `${base64url({ alg: "RS256", typ: "JWT", kid: "abc" })}.${base64url(
  { iss: "https://tenant.eu.auth0.com/", sub: "auth0|1", exp: 4102444800 },
)}.c2lnbmF0dXJl`;

// Shape of an Auth0 encrypted access token: five segments, dir/A256GCM header.
const compactJwe = [
  base64url({
    alg: "dir",
    enc: "A256GCM",
    iss: "https://tenant.eu.auth0.com/",
  }),
  "",
  "aXY",
  "Y2lwaGVydGV4dA",
  "dGFn",
].join(".");

describe("decodeJwt", () => {
  it("decodes a signed JWT into header and payload", () => {
    const decoded = decodeJwt(signedJwt);
    expect(decoded.format).toBe("jwt");
    expect(JSON.parse(decoded.header).alg).toBe("RS256");
    expect(JSON.parse(decoded.payload).sub).toBe("auth0|1");
  });

  it("ignores a Bearer-style leading and trailing whitespace", () => {
    expect(decodeJwt(`  ${signedJwt}  `).format).toBe("jwt");
  });

  it("reports a compact JWE and leaves the payload unreadable", () => {
    const decoded = decodeJwt(compactJwe);
    expect(decoded.format).toBe("jwe");
    expect(decoded.payload).toBe("");
    const header = JSON.parse(decoded.header);
    expect(header.alg).toBe("dir");
    expect(header.enc).toBe("A256GCM");
  });

  it("treats a three-segment token carrying enc as a JWE too", () => {
    const token = `${base64url({ alg: "dir", enc: "A256GCM" })}.x.y`;
    expect(decodeJwt(token).format).toBe("jwe");
  });

  it("calls a token that never claimed to be a JWT opaque, not invalid", () => {
    // What Auth0 returns when the authorization request names no API audience.
    // Reporting it as invalid stopped the wizard on a perfectly good token.
    expect(decodeJwt("not-a-token")).toEqual({
      header: "",
      payload: "",
      format: "opaque",
    });
    expect(decodeJwt("vjtOFdSTKp1RxLHhqBcMzYw8gN4uEa2i").format).toBe("opaque");
  });

  it("keeps invalid for something shaped like a JWT that will not decode", () => {
    expect(decodeJwt("aaa.bbb.ccc").format).toBe("invalid");
    expect(decodeJwt("").format).toBe("invalid");
  });

  it("counts the segments exactly, since only three or five are a JWT", () => {
    // Four segments is neither a compact JWS nor a compact JWE, so calling it a
    // malformed JWT overstates what is known. A single `{2,4}` repetition range
    // over the dots accepted it.
    expect(decodeJwt("aaa.bbb.ccc.ddd").format).toBe("opaque");
    expect(decodeJwt("aaa.bbb.ccc.ddd.eee").format).toBe("invalid");
    // and a leading empty segment is not a header, whatever follows it
    expect(decodeJwt(".bbb.ccc").format).toBe("opaque");
  });
});
