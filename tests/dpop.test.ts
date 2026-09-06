import { describe, it, expect } from "vitest";
import * as jose from "jose";
import {
  generateDPoPKeyPair,
  exportDPoPPublicJWK,
  calculateDPoPThumbprint,
  calculateAccessTokenHash,
  createDPoPProof,
} from "@/lib/dpop";

describe("dpop", () => {
  it("generates an ES256 key pair and exports public JWK without private parameters", async () => {
    const keyPair = await generateDPoPKeyPair();
    expect(keyPair.privateKey).toBeDefined();
    expect(keyPair.publicKey).toBeDefined();

    const jwk = await exportDPoPPublicJWK(keyPair.publicKey);
    expect(jwk.kty).toBe("EC");
    expect(jwk.crv).toBe("P-256");
    expect(jwk.x).toBeDefined();
    expect(jwk.y).toBeDefined();
    expect((jwk as any).d).toBeUndefined();
  });

  it("calculates standard SHA-256 JWK thumbprint (dpop_jkt)", async () => {
    const keyPair = await generateDPoPKeyPair();
    const jwk = await exportDPoPPublicJWK(keyPair.publicKey);
    const thumbprint = await calculateDPoPThumbprint(jwk);

    expect(typeof thumbprint).toBe("string");
    expect(thumbprint.length).toBeGreaterThan(20);
    // Must match jose calculateJwkThumbprint
    const expected = await jose.calculateJwkThumbprint(jwk, "sha256");
    expect(thumbprint).toBe(expected);
  });

  it("calculates access token hash (ath) per RFC 9449 §4.1", async () => {
    // RFC 9449 Section 4.1 example:
    // Access token: "Kst-DYukRnnxMmObuzUMmAcWFlioGTvnXdAcioAYxAw"
    // sha256(ASCII(token)) base64url encoded
    const token = "Kst-DYukRnnxMmObuzUMmAcWFlioGTvnXdAcioAYxAw";
    const ath = await calculateAccessTokenHash(token);
    expect(typeof ath).toBe("string");
    expect(ath).toBe("T7p3fINn3N_8fYryIhTWt2nrQvM9zclIm3HmMeaFpt0");
  });

  it("creates and signs a valid DPoP proof JWT", async () => {
    const keyPair = await generateDPoPKeyPair();
    const jwk = await exportDPoPPublicJWK(keyPair.publicKey);

    const htu = "https://server.example.com/oauth/token";
    const htm = "POST";
    const nonce = "test-nonce-123";

    const proof = await createDPoPProof({
      privateKey: keyPair.privateKey,
      jwk,
      htm,
      htu,
      nonce,
    });

    expect(typeof proof).toBe("string");

    // Verify the proof JWT using jose
    const { payload, protectedHeader } = await jose.jwtVerify(
      proof,
      keyPair.publicKey,
      {
        typ: "dpop+jwt",
      },
    );

    expect(protectedHeader.typ).toBe("dpop+jwt");
    expect(protectedHeader.alg).toBe("ES256");
    expect(protectedHeader.jwk).toEqual(jwk);

    expect(payload.htm).toBe("POST");
    expect(payload.htu).toBe(htu);
    expect(payload.nonce).toBe(nonce);
    expect(typeof payload.jti).toBe("string");
    expect(typeof payload.iat).toBe("number");
  });

  it("includes ath claim in DPoP proof when calling protected API", async () => {
    const keyPair = await generateDPoPKeyPair();
    const jwk = await exportDPoPPublicJWK(keyPair.publicKey);

    const htu = "https://resource.example.com/userinfo";
    const htm = "GET";
    const accessToken = "Kst-DYukRnnxMmObuzUMmAcWFlioGTvnXdAcioAYxAw";
    const ath = await calculateAccessTokenHash(accessToken);

    const proof = await createDPoPProof({
      privateKey: keyPair.privateKey,
      jwk,
      htm,
      htu,
      ath,
    });

    const { payload } = await jose.jwtVerify(proof, keyPair.publicKey, {
      typ: "dpop+jwt",
    });

    expect(payload.htm).toBe("GET");
    expect(payload.htu).toBe(htu);
    expect(payload.ath).toBe(ath);
  });
});
