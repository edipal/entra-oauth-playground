import { describe, expect, it } from "vitest";
import { decodeProtectedHeader, decodeJwt } from "jose";
import { buildAuthorizationRequestObject } from "@/lib/requestObject";

// A throwaway RSA-2048 private key generated for this file. It signs nothing that
// exists; the assertions are about the shape of the request object.
const PRIVATE_KEY_PEM = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCU7KDTpsGHVzSr
zFmTwcjh4vB9n2YFxmOhezHDQNlHxXhLjBooFI1k5DmOKf+5KGFhTfmjpPZbd4Kk
YCZCYF22x4tnsosQUcDsHyNYoa5kcADezjruRSajt6++rUSZ+Pn/GGmgxg2q/Q3J
s4IlqcE0lPtZEmPU5bzqKhY5zOv8cbcopBZblXluwl09mI+JykgWKKCKgURkb4O6
dZEz78r81KjQhg0GTRDW/Mc5vlDIQNUbYFDSGbtkSVMqYzVMqZRn/2w4nZtNgno5
u6k+GD/XFwzONhZIMNnnQFdTqkysQm7WEOEeP3YbEhSSFl3eSpBjsCK8LKXhxULs
HNACrv49AgMBAAECggEAXnCQrKebIpCSvj+grqq9EUIw7/kdYZwloknVjNSa9YCs
gHwgOjqOT+TK+vR3Tpvk5Sfln3kFIYvwNP0kRgOGalqwdNoshfTSOuqkJ5igVuEQ
LDrr9B22GyxpLqoCTwIsxzBcC7CNClnfXIGRjwDPnOC9ZAbdeC0YWAbIgW8KV9Nt
hMIXtRiD89xcahR6d04dF1iXpk8ouvPjFKuWRVK6vFVNwv2gVUgahdcona0UzQUp
QmjkeQmHM0LbGKEND2oegsn11oNnahtUf3FLULy3u2qaS+VlDM1T/VfFhtAqHW+i
sRFGEzjTS+Saob7LvmSE7CqEYwxO8e9C4q6GF9IMAQKBgQDEnxdFovrUOZovktMd
UMXpmtt9BkHZuaO1theiLC+57tJNl03KV9blyuZrJjzG3mq9pgEt71vsZZNQTeQB
J8INMid8XwUcvQyIlEWQZjUJANArLRQWhqNS/dL3lqWWXFxc5wgUtYkE1+RhLIEK
Ej0pMnE0NFvNOJO8OgPE+kLj4QKBgQDB5gwr/T9G9fr9FqK58srI/MTwqxYUBe6o
Ecde73MxPTepku81tBOc8RKTI671OnF56ztRZHQvgFlg3ND4aoocDKThgdLaPKvD
pxnhcTESH7x5HqVrBWTqu5/qanFEJj91t7hIg1RjVj/xWYBZrbIFXvq6Nk4ymrd7
17A5RBjl3QKBgQCiPVfZmRL5nRIx4SgcT3MPQD2OG2SowDpqjPdRVL6I4Jxdc9S3
euWStWqNzX5m5k4TcPAWNCSYmnQE1lCl92VyuAjG4iz4urGl3RrNfNiUNjyO8+JY
d/46U8EJlR/LQyjfa69KT0ThXzdOS4eqhMQ8wyeP2QhK/T1CGmjT12DsYQKBgQC/
imVTvyQXET8TbJzrW7B+w1Q4+okg1otfc9CjM59zcKnf1cqAHpeRXYOf3owiq80V
Rw6d5MHxerTQPtIf0/8CnmryabDE7VIwQI4MaiizYq5oZ6G5CucaCqZ6hxPE4pOl
0gs1dqaSSs13uZZVAITvUVgVQzgUPUosCHGI4IBH8QKBgBHxyCACeA6bRu2FvIas
LRc+d6PKCzVWsPXlFi/Xn37l2xGvzqayxZKhSol9TT8azNf9bzYd8BHcoH6svbvX
oTSCq+6BOtrCFULOoZ/eWVAZCM6Wj0VSdfmep0plVea5m1AAYWdee3b73Vcw1Psy
yNCik2hJvF9D6p5OtziOQwPT
-----END PRIVATE KEY-----`;

const ISSUER = "https://tenant.eu.auth0.com";
// Auth0 rejects a request object addressed to the bare issuer — measured live.
const AUDIENCE = `${ISSUER}/`;
const CLIENT_ID = "K8sQx2mVdemoClientIdExample7pLzR";

const baseClaims = {
  client_id: CLIENT_ID,
  redirect_uri: "https://localhost:3000/callback/auth-code",
  response_type: "code",
  scope: "openid profile",
  state: "state-value",
  nonce: "nonce-value",
};

describe("buildAuthorizationRequestObject", () => {
  it("types the header as a request object and names the signing key", async () => {
    const jwt = await buildAuthorizationRequestObject({
      audience: AUDIENCE,
      clientId: CLIENT_ID,
      privateKeyPem: PRIVATE_KEY_PEM,
      claims: baseClaims,
      kid: "R9wAbWVeoPOl3PUxgiGi2k2BzuDFWKYxZMigYlp3q9s",
    });

    const header = decodeProtectedHeader(jwt);
    expect(header.alg).toBe("RS256");
    // RFC 9101 requires this typ so a request object cannot be confused with an
    // access token or an id token
    expect(header.typ).toBe("oauth-authz-req+jwt");
    expect(header.kid).toBe("R9wAbWVeoPOl3PUxgiGi2k2BzuDFWKYxZMigYlp3q9s");
  });

  it("addresses the object to the tenant and issues it from the client", async () => {
    const jwt = await buildAuthorizationRequestObject({
      audience: AUDIENCE,
      clientId: CLIENT_ID,
      privateKeyPem: PRIVATE_KEY_PEM,
      claims: baseClaims,
    });

    const payload = decodeJwt(jwt);
    expect(payload.iss).toBe(CLIENT_ID);
    expect(payload.aud).toBe(AUDIENCE);
    expect(
      payload.jti,
      "a replayable request object needs a unique id",
    ).toBeTruthy();
  });

  it("keeps the object short-lived", async () => {
    const jwt = await buildAuthorizationRequestObject({
      audience: AUDIENCE,
      clientId: CLIENT_ID,
      privateKeyPem: PRIVATE_KEY_PEM,
      claims: baseClaims,
    });

    const payload = decodeJwt(jwt);
    expect((payload.exp as number) - (payload.iat as number)).toBe(60);
  });

  it("carries the authorization parameters, including rich authorization details", async () => {
    const authorizationDetails = JSON.stringify([
      { type: "payment_initiation", locations: ["https://api.example.com"] },
    ]);

    const jwt = await buildAuthorizationRequestObject({
      audience: AUDIENCE,
      clientId: CLIENT_ID,
      privateKeyPem: PRIVATE_KEY_PEM,
      claims: { ...baseClaims, authorization_details: authorizationDetails },
    });

    const payload = decodeJwt(jwt);
    expect(payload.redirect_uri).toBe(baseClaims.redirect_uri);
    expect(payload.response_type).toBe("code");
    expect(payload.scope).toBe("openid profile");
    expect(payload.state).toBe("state-value");
    expect(payload.nonce).toBe("nonce-value");
    expect(payload.authorization_details).toBe(authorizationDetails);
  });

  it("gives each object a distinct jti", async () => {
    const build = () =>
      buildAuthorizationRequestObject({
        audience: AUDIENCE,
        clientId: CLIENT_ID,
        privateKeyPem: PRIVATE_KEY_PEM,
        claims: baseClaims,
      });

    const [first, second] = await Promise.all([build(), build()]);
    expect(decodeJwt(first).jti).not.toBe(decodeJwt(second).jti);
  });
});
