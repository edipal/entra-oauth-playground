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

  it("returns the invalid shape for junk input", () => {
    expect(decodeJwt("not-a-token")).toEqual({
      header: "",
      payload: "",
      format: "invalid",
    });
    expect(decodeJwt("").format).toBe("invalid");
  });
});
