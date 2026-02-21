// Certificate and key pair generation utilities for browser environments.
// Uses Web Crypto API to generate RSA keys and create self-signed X.509 certificates.

/**
 * Generates an RSA-2048 key pair suitable for JWT signing (RS256).
 * Returns both private and public keys in PKCS#8 and SPKI PEM formats.
 */
export async function generateRsaKeyPair(): Promise<{
  privateKeyPem: string;
  publicKeyPem: string;
  privateKey: CryptoKey;
  publicKey: CryptoKey;
}> {
  const subtle = (globalThis as any)?.crypto?.subtle as
    | SubtleCrypto
    | undefined;
  if (!subtle) throw new Error("WebCrypto SubtleCrypto is not available");

  // Generate RSA-2048 key pair
  const keyPair = await subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]), // 65537
      hash: "SHA-256",
    },
    true, // extractable
    ["sign", "verify"],
  );

  // Export private key as PKCS#8
  const privateKeyArrayBuffer = await subtle.exportKey(
    "pkcs8",
    keyPair.privateKey,
  );
  const privateKeyPem = arrayBufferToPem(privateKeyArrayBuffer, "PRIVATE KEY");

  // Export public key as SPKI
  const publicKeyArrayBuffer = await subtle.exportKey(
    "spki",
    keyPair.publicKey,
  );
  const publicKeyPem = arrayBufferToPem(publicKeyArrayBuffer, "PUBLIC KEY");

  return {
    privateKeyPem,
    publicKeyPem,
    privateKey: keyPair.privateKey,
    publicKey: keyPair.publicKey,
  };
}

/**
 * Creates a self-signed X.509 certificate for the given public key.
 * This generates a proper X.509v3 certificate in DER format (PEM-encoded)
 * that can be uploaded to Microsoft Entra ID.
 */
export async function createSelfSignedCertificate(params: {
  publicKeyPem: string;
  privateKey: CryptoKey;
  subject?: string;
  validDays?: number;
}): Promise<{
  certificatePem: string;
  thumbprintSha1: string;
  thumbprintSha256: string;
  thumbprintSha1Base64Url: string;
  thumbprintSha256Base64Url: string;
}> {
  const {
    publicKeyPem,
    privateKey,
    subject = "CN=OAuth Playground Demo",
    validDays = 365,
  } = params;

  const subtle = (globalThis as any)?.crypto?.subtle as
    | SubtleCrypto
    | undefined;
  if (!subtle) throw new Error("WebCrypto SubtleCrypto is not available");

  // Extract the public key data from PEM (SPKI format)
  const publicKeyData = pemToArrayBuffer(publicKeyPem, "PUBLIC KEY");

  // Build a proper X.509v3 certificate using ASN.1 DER encoding
  const notBefore = new Date();
  const notAfter = new Date(
    notBefore.getTime() + validDays * 24 * 60 * 60 * 1000,
  );

  // Generate serial number (random 8 bytes)
  const serialNumber = new Uint8Array(8);
  crypto.getRandomValues(serialNumber);

  // Build TBSCertificate (To Be Signed Certificate)
  const tbsCertificate = buildTBSCertificate({
    serialNumber,
    subject,
    notBefore,
    notAfter,
    publicKeyData,
  });

  // Sign the TBSCertificate
  const signature = await subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    tbsCertificate,
  );

  // Build the complete certificate (TBSCertificate + AlgorithmIdentifier + Signature)
  const certificate = buildCertificate(tbsCertificate, signature);

  // Convert to PEM format
  const certificatePem = arrayBufferToPem(certificate, "CERTIFICATE");

  // Calculate thumbprints (hash of the DER-encoded certificate)
  const sha1Hash = await subtle.digest("SHA-1", certificate);
  const sha256Hash = await subtle.digest("SHA-256", certificate);

  const thumbprintSha1 = arrayBufferToHex(sha1Hash);
  const thumbprintSha256 = arrayBufferToHex(sha256Hash);

  // Also provide base64url-encoded thumbprints for JWT x5t header
  const thumbprintSha1Base64Url = arrayBufferToBase64Url(sha1Hash);
  const thumbprintSha256Base64Url = arrayBufferToBase64Url(sha256Hash);

  return {
    certificatePem,
    thumbprintSha1,
    thumbprintSha256,
    thumbprintSha1Base64Url,
    thumbprintSha256Base64Url,
  };
}

/**
 * Builds a TBSCertificate (To Be Signed Certificate) structure in DER format.
 * This is a simplified but valid X.509v3 certificate structure.
 */
function buildTBSCertificate(params: {
  serialNumber: Uint8Array;
  subject: string;
  notBefore: Date;
  notAfter: Date;
  publicKeyData: ArrayBuffer;
}): ArrayBuffer {
  const { serialNumber, subject, notBefore, notAfter, publicKeyData } = params;

  // X.509 TBSCertificate structure (simplified):
  // SEQUENCE {
  //   version [0] EXPLICIT Version DEFAULT v1,
  //   serialNumber INTEGER,
  //   signature AlgorithmIdentifier (sha256WithRSAEncryption),
  //   issuer Name,
  //   validity Validity,
  //   subject Name,
  //   subjectPublicKeyInfo SubjectPublicKeyInfo
  // }

  const parts: Uint8Array[] = [];

  // Version [0] EXPLICIT v3 (2)
  parts.push(encodeASN1(0xa0, encodeASN1(0x02, new Uint8Array([2]))));

  // Serial number (INTEGER)
  parts.push(encodeASN1(0x02, serialNumber));

  // Signature algorithm (sha256WithRSAEncryption OID: 1.2.840.113549.1.1.11)
  const sigAlgOID = new Uint8Array([
    0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x0b,
  ]);
  const sigAlg = encodeASN1(
    0x30,
    concatenate([
      encodeASN1(0x06, sigAlgOID),
      encodeASN1(0x05, new Uint8Array(0)), // NULL
    ]),
  );
  parts.push(sigAlg);

  // Issuer (same as subject for self-signed)
  const issuerDN = encodeDN(subject);
  parts.push(issuerDN);

  // Validity
  const validity = encodeASN1(
    0x30,
    concatenate([encodeUTCTime(notBefore), encodeUTCTime(notAfter)]),
  );
  parts.push(validity);

  // Subject
  const subjectDN = encodeDN(subject);
  parts.push(subjectDN);

  // SubjectPublicKeyInfo (already in SPKI format)
  parts.push(new Uint8Array(publicKeyData));

  // Wrap in SEQUENCE
  const result = encodeASN1(0x30, concatenate(parts));
  return result.buffer as ArrayBuffer;
}

/**
 * Builds the complete X.509 certificate structure.
 */
function buildCertificate(
  tbsCertificate: ArrayBuffer,
  signature: ArrayBuffer,
): ArrayBuffer {
  // Certificate SEQUENCE {
  //   tbsCertificate,
  //   signatureAlgorithm AlgorithmIdentifier,
  //   signatureValue BIT STRING
  // }

  const parts: Uint8Array[] = [];

  // TBSCertificate
  parts.push(new Uint8Array(tbsCertificate));

  // Signature algorithm (sha256WithRSAEncryption)
  const sigAlgOID = new Uint8Array([
    0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x0b,
  ]);
  const sigAlg = encodeASN1(
    0x30,
    concatenate([
      encodeASN1(0x06, sigAlgOID),
      encodeASN1(0x05, new Uint8Array(0)), // NULL
    ]),
  );
  parts.push(sigAlg);

  // Signature value (BIT STRING)
  // BIT STRING format: [unused bits count] [data...]
  const sigWithPadding = concatenate([
    new Uint8Array([0]),
    new Uint8Array(signature),
  ]);
  parts.push(encodeASN1(0x03, sigWithPadding));

  // Wrap in SEQUENCE
  const result = encodeASN1(0x30, concatenate(parts));
  return result.buffer as ArrayBuffer;
}

/**
 * Encodes a Distinguished Name (DN) from a simple string like "CN=Example".
 */
function encodeDN(dn: string): Uint8Array {
  // Parse simple DN format "CN=Value" or "CN=Value,O=Org"
  const parts = dn.split(",").map((p) => p.trim());
  const rdns: Uint8Array[] = [];

  for (const part of parts) {
    const [attrType, attrValue] = part.split("=").map((s) => s.trim());

    // Map attribute type to OID
    let oid: Uint8Array;
    if (attrType === "CN") {
      oid = new Uint8Array([0x55, 0x04, 0x03]); // commonName
    } else if (attrType === "O") {
      oid = new Uint8Array([0x55, 0x04, 0x0a]); // organizationName
    } else if (attrType === "C") {
      oid = new Uint8Array([0x55, 0x04, 0x06]); // countryName
    } else {
      oid = new Uint8Array([0x55, 0x04, 0x03]); // default to CN
    }

    // AttributeTypeAndValue SEQUENCE
    const attrTypeValue = encodeASN1(
      0x30,
      concatenate([
        encodeASN1(0x06, oid),
        encodeASN1(0x0c, new TextEncoder().encode(attrValue)), // UTF8String
      ]),
    );

    // RelativeDistinguishedName SET
    rdns.push(encodeASN1(0x31, attrTypeValue));
  }

  // Name SEQUENCE
  return encodeASN1(0x30, concatenate(rdns));
}

/**
 * Encodes a Date as UTCTime (YYMMDDHHMMSSZ).
 */
function encodeUTCTime(date: Date): Uint8Array {
  const year = String(date.getUTCFullYear()).slice(2);
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");
  const utcTime = `${year}${month}${day}${hours}${minutes}${seconds}Z`;
  return encodeASN1(0x17, new TextEncoder().encode(utcTime));
}

/**
 * Encodes data in ASN.1 DER format with the given tag.
 */
function encodeASN1(tag: number, data: Uint8Array): Uint8Array {
  const length = data.length;
  let lengthBytes: Uint8Array;

  if (length < 128) {
    // Short form
    lengthBytes = new Uint8Array([length]);
  } else {
    // Long form
    const lengthOfLength = Math.ceil(Math.log2(length + 1) / 8);
    lengthBytes = new Uint8Array(1 + lengthOfLength);
    lengthBytes[0] = 0x80 | lengthOfLength;
    for (let i = 0; i < lengthOfLength; i++) {
      lengthBytes[1 + i] = (length >> (8 * (lengthOfLength - 1 - i))) & 0xff;
    }
  }

  return concatenate([new Uint8Array([tag]), lengthBytes, data]);
}

/**
 * Concatenates multiple Uint8Arrays into a single Uint8Array.
 */
function concatenate(arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

/**
 * Converts an ArrayBuffer to PEM format.
 */
function arrayBufferToPem(buffer: ArrayBuffer, label: string): string {
  const base64 = arrayBufferToBase64(buffer);
  const lines = base64.match(/.{1,64}/g) || [base64];
  return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----`;
}

/**
 * Converts PEM to ArrayBuffer.
 */
function pemToArrayBuffer(pem: string, label: string): ArrayBuffer {
  const pemHeader = `-----BEGIN ${label}-----`;
  const pemFooter = `-----END ${label}-----`;
  const pemContents = pem
    .replace(pemHeader, "")
    .replace(pemFooter, "")
    .replace(/\s/g, "");
  return base64ToArrayBuffer(pemContents);
}

/**
 * Converts ArrayBuffer to base64 string.
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return typeof window !== "undefined"
    ? window.btoa(binary)
    : Buffer.from(bytes).toString("base64");
}

/**
 * Converts base64 string to ArrayBuffer.
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary =
    typeof window !== "undefined"
      ? window.atob(base64)
      : Buffer.from(base64, "base64").toString("binary");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Converts ArrayBuffer to hexadecimal string.
 */
function arrayBufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Converts ArrayBuffer to base64url string (RFC 4648).
 * This is used for JWT x5t header values.
 */
function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const base64 = arrayBufferToBase64(buffer);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
