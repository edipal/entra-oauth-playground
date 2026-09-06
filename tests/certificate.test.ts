import { describe, expect, it } from "vitest";
import { computeCertificateThumbprints } from "@/lib/certificate";

// A real self-signed certificate. Its SHA-1 fingerprint was verified independently
// with `openssl x509 -noout -fingerprint -sha1`, so these assertions pin the
// implementation to an externally computed value rather than to itself.
const CERTIFICATE_PEM = `-----BEGIN CERTIFICATE-----
MIICwDCCAaigAwIBAgIIPpi/rDDdYekwDQYJKoZIhvcNAQELBQAwIDEeMBwGA1UE
AwwVT0F1dGggUGxheWdyb3VuZCBEZW1vMB4XDTI2MDgwODE5MjM0OFoXDTI3MDgw
ODE5MjM0OFowIDEeMBwGA1UEAwwVT0F1dGggUGxheWdyb3VuZCBEZW1vMIIBIjAN
BgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAx40m746dq6/6RzO5uEeDt/G0IFDr
NYeybmPfRg3LGPcvRkw2h+gVdPHFc0Yc7cCY2AkHhflGuw4JzzbgDtxRKd1VfkZb
BYZa456Uzlf6s4NhwGnE4R0T0s/q49vKo3aoRa92Qv1k8CUptvEefCkbHSfS0xM4
PCdTT6PurfISDaKkw4ROwMEJeRgYqc4h+//NIdt5SorSSAs2EvUNJeFoZ0YSHEJk
WZaj+Tw/CFiWlRv43miDrvvz27USC1iP7XPpZiNtunoaPbfhcsdnHX8EZXkBpw+p
BTKJWHpeSHvgRt/7BcrqwRpp6Ek5kItYYnKpt2wu1w6EpOJoBI2cJ38z+QIDAQAB
MA0GCSqGSIb3DQEBCwUAA4IBAQCl6nIWsjAh6BEYP0HeAicNJ7ouSRzN9Do25t22
FYMIW9QmMO43jspvQRJ0NbHl7hDKxwuzS45b2D7pUfgkwK+RFPuirOl6LB3JD4vW
txx/IR09GUBIt0FwfM7j1DIFTXJV/BDEjZtiFak4ZkH+U7GNlr/f2bCMU7l+FLch
rFHdLybTRFUjDjg2S5nkCUfPQfPk97h+URaFoGxnNyM7aE+N/tUQJ72S4F/2flP4
gNHee1oGX59xI8rm7HQr2d6SAEer3bLvVfhjsZIhJXUCic8trqENEJD+wKyKXqJU
wLxcmLIt4qq88CKSmmUTcvs7Va74RQJVb17erf1yEZSA8TD7
-----END CERTIFICATE-----`;

const SHA1_HEX = "d782c842abfc2e6ce3054fde2fc6d5b1c1e745b9";
const SHA1_BASE64URL = "14LIQqv8LmzjBU_eL8bVscHnRbk";

describe("computeCertificateThumbprints", () => {
  it("matches the fingerprint openssl reports for the same certificate", async () => {
    const result = await computeCertificateThumbprints(CERTIFICATE_PEM);

    expect(result?.thumbprintSha1).toBe(SHA1_HEX);
  });

  it("base64url-encodes the same bytes for the x5t header", async () => {
    const result = await computeCertificateThumbprints(CERTIFICATE_PEM);

    expect(result?.thumbprintSha1Base64Url).toBe(SHA1_BASE64URL);
    // the two encodings must describe identical bytes
    expect(
      Buffer.from(result!.thumbprintSha1Base64Url, "base64url").toString("hex"),
    ).toBe(result!.thumbprintSha1);
  });

  it("also returns SHA-256 in both encodings", async () => {
    const result = await computeCertificateThumbprints(CERTIFICATE_PEM);

    expect(result?.thumbprintSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(
      Buffer.from(result!.thumbprintSha256Base64Url, "base64url").toString(
        "hex",
      ),
    ).toBe(result!.thumbprintSha256);
  });

  it("tolerates surrounding whitespace and CRLF line endings", async () => {
    const messy = `\n  ${CERTIFICATE_PEM.replaceAll("\n", "\r\n")}  \n`;
    const result = await computeCertificateThumbprints(messy);

    expect(result?.thumbprintSha1).toBe(SHA1_HEX);
  });

  it("thumbprints the leaf when a chain is pasted", async () => {
    // What a CA hands you and what `openssl` writes by default. The leaf comes
    // first and is the certificate `x5t` identifies, so the answer must be the
    // same as for the leaf alone — not null, which is what stripping delimiters
    // by substring produced.
    const chain = `${CERTIFICATE_PEM}\n${CERTIFICATE_PEM.replace(
      "MIICwDCCAaig",
      "MIICwDCCAaih",
    )}`;

    const result = await computeCertificateThumbprints(chain);

    expect(result?.thumbprintSha1).toBe(SHA1_HEX);
    expect(result?.thumbprintSha1Base64Url).toBe(SHA1_BASE64URL);
  });

  it("returns null for a certificate block that was cut off", async () => {
    const truncated = CERTIFICATE_PEM.replace("-----END CERTIFICATE-----", "");

    expect(await computeCertificateThumbprints(truncated)).toBeNull();
  });

  it("returns null for anything that is not a certificate PEM", async () => {
    expect(await computeCertificateThumbprints("")).toBeNull();
    expect(await computeCertificateThumbprints("   ")).toBeNull();
    expect(await computeCertificateThumbprints("not a certificate")).toBeNull();
    expect(
      await computeCertificateThumbprints(
        "-----BEGIN PRIVATE KEY-----\nMIIE\n-----END PRIVATE KEY-----",
      ),
    ).toBeNull();
  });
});
