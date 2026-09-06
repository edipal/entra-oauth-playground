import { describe, expect, it } from "vitest";
import { decodeProtectedHeader, decodeJwt } from "jose";
import {
  buildClientAssertion,
  buildClientAssertionClaims,
} from "@/lib/jwtSign";

// A throwaway RSA-2048 private key, generated for this test file only. It signs
// nothing that exists, so the assertions below are about shape, not secrecy.
const PRIVATE_KEY_PEM = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDPCc1qK64t76Hb
kGt94KSErh7O6XakaMV8PPXNFAcZeQDM0wadw9AdrhUf4zev/l5yIx7YJf6qXzIH
eRxQd/ZcuxCufls0BQvMZNEltTRTifOTh8O1PUkOmg2MIziJD6Onw5MP7SpmzEop
L8t6SpiFTYvxRt+AC+mnR7CQQZxt5OKJcSBtucrGGiEQ801jrx0oG0neLxuWXLQL
GDcWMerK2arWTkYS+mVz96TB/MsgqTHRCFqCSZ5RulI+Um9zlJgPASuqcEzjNdMT
s8eWD4FGMV9b0GOwdWrbH35tzvMRo18Idu0g6wgYpCHuZ/anCV4MD0Lc6iVFcPNc
cCyeg+drAgMBAAECggEAC6KOY7AOutAjtXYZRFqyhC5Q1unx2+1zY7b9TUgZ2gmd
zOTzEzyk3nYhA8i+IWrXHezxV85S0HpHEnpw5+jF9JIirtu0/mhmMFdeFZNoXGV9
RcY0bmQCTgrERiLYk4NIfC4WfqeiYWKLrGLeOYIlriAchDOqbcS9ncP+nSzCwL4p
MSwHcs3F5pN6mQJz4dNZjdnbyHwOX0hAATPS85EWPAcI9eZFyXfbhTPPuOOgxZlJ
VPVLwHg5W4wmzx4B3gRGIs4c2AGZfYcnwqiDbaRe955zpmiMCbqJiPO2yq9mVG7b
e4InUbitYcsh+ubq1ZExpfTiga8KY11c7N1QSWx6qQKBgQD6dmnpqmuhH+sLU0RF
Ok04DDPuUAkjINVy9tw9IguUBhH1m2FnyRlcWtDbePggxo8HqO4ecY1bvk1MNaNt
B2M/SUQzohRvYI2NClCPGjNTQ+y6fu9DAMvqWqseNEnhDdWI3dt/VtUqyoPfsW1o
naWlCIuSbQszgXHOnHGyG3IeRQKBgQDTnZzkaCoJ7dIj0TZNlNOVpZJN+i0AOHTi
TrPv/KCMfad08Hckgp9rlnPOlrRWTOQ7GYgUC3RUqfsTA2nrRk0AJL0zqahKSEt1
qbmLU8SBJExXO0Ihbn4cPIcFoJZyS7t+ARD61LhwExPVG3uUvs4OSk57o/bZr/7Y
ae0FelPh7wKBgQC8sj/jQnjqIGD13FrgCSeqJU9uqS/pHlCR17hf+mlcsSIQt2qw
RYrs0KLv5viRwOZ7b+NOXmCQkRQtaW/hsaItSOawO9lHfCfI7c95sNSgU9ljPETI
Zy46Nusay2wpuUF6ZyN6kZHyNjcabdMu8S6d4o082RiKSmjSr3zdId5dPQKBgQC1
VNPCLTgItg9hvb6IkEUWcICD7SJuk/IkkkhCFvoEKRA7dmrBkGTHLm8h0aXKZa0U
r3YZpw8SFW4eBsjWYLFOtCykfnbE4Fo5Ay0JJMi32MDJ5u9t8l6CF6OjwM3qNtb8
zDEenvVEpDRUYm5tMWskd6v06rV2KAd6rpn6Ha6PZQKBgDeE/tP/L9OAZA+NP93Z
RoZihu6YOFvoOxD7tUftV/zktLGq4pJCjha549EdUZR9YXRkVVHSenbDO6XzKeja
wFC5ykb3xnC2lxDXCGhFVwFrNv4rdgmdBgACQwFkt4bptrOnCZhSqNBXccbRMQ4d
aOvi29qqaGwxWXUFpcrCZ/ia
-----END PRIVATE KEY-----`;

const CLIENT_ID = "test-client-id";

describe("buildClientAssertionClaims", () => {
  it("uses the supplied audience verbatim as aud", () => {
    const claims = buildClientAssertionClaims({
      clientId: CLIENT_ID,
      audience: "https://tenant.eu.auth0.com/",
    });

    expect(claims.aud).toBe("https://tenant.eu.auth0.com/");
    expect(claims.iss).toBe(CLIENT_ID);
    expect(claims.sub).toBe(CLIENT_ID);
  });

  it("keeps exp within the 5 minutes Auth0 allows after iat", () => {
    const claims = buildClientAssertionClaims({
      clientId: CLIENT_ID,
      audience: "https://tenant.eu.auth0.com/",
    });

    expect(claims.exp - claims.iat).toBe(60);
    expect(claims.exp - claims.iat).toBeLessThanOrEqual(300);
  });
});

describe("buildClientAssertion", () => {
  it("omits x5t when only a kid is supplied, which is the Auth0 shape", async () => {
    const assertion = await buildClientAssertion({
      clientId: CLIENT_ID,
      audience: "https://tenant.eu.auth0.com/",
      privateKeyPem: PRIVATE_KEY_PEM,
      kid: "NnZ4Rk1hbmFnZW1lbnRBUElUaHVtYnByaW50",
    });

    const header = decodeProtectedHeader(assertion);
    expect(header.alg).toBe("RS256");
    expect(header.kid).toBe("NnZ4Rk1hbmFnZW1lbnRBUElUaHVtYnByaW50");
    expect(header).not.toHaveProperty("x5t");
  });

  it("carries both x5t and kid when both are supplied, which is the Entra shape", async () => {
    const assertion = await buildClientAssertion({
      clientId: CLIENT_ID,
      audience: "https://login.microsoftonline.com/tenant/oauth2/v2.0/token",
      privateKeyPem: PRIVATE_KEY_PEM,
      x5t: "14LIQqv8Lmzjs87eL8bVscHnRbk",
      kid: "d782c842abfc2e6ce3054fde2fc6d5b1c1e745b9",
    });

    const header = decodeProtectedHeader(assertion);
    expect(header.x5t).toBe("14LIQqv8Lmzjs87eL8bVscHnRbk");
    expect(header.kid).toBe("d782c842abfc2e6ce3054fde2fc6d5b1c1e745b9");
  });

  it("signs the audience it is given rather than an endpoint of its own choosing", async () => {
    const assertion = await buildClientAssertion({
      clientId: CLIENT_ID,
      audience: "https://tenant.eu.auth0.com/",
      privateKeyPem: PRIVATE_KEY_PEM,
    });

    const payload = decodeJwt(assertion);
    expect(payload.aud).toBe("https://tenant.eu.auth0.com/");
    expect(payload.iss).toBe(CLIENT_ID);
    expect(payload.sub).toBe(CLIENT_ID);
    expect(payload.jti).toBeTruthy();
    expect((payload.exp as number) - (payload.iat as number)).toBe(60);
  });
});
