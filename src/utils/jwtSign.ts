// Utilities to build and sign JWTs (RS256) in the browser using Web Crypto.
// Used for client_assertion (private_key_jwt) when exchanging tokens as a confidential client.

export type JwtHeader = Record<string, any>;
export type JwtPayload = Record<string, any>;

const textEncoder = new TextEncoder();

export const base64urlEncode = (data: ArrayBuffer | Uint8Array | string): string => {
  let bytes: Uint8Array;
  if (typeof data === 'string') {
    bytes = textEncoder.encode(data);
  } else if (data instanceof Uint8Array) {
    bytes = data;
  } else {
    bytes = new Uint8Array(data);
  }
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const b64 = (typeof window !== 'undefined' && typeof window.btoa === 'function')
    ? window.btoa(bin)
    : Buffer.from(bytes).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const stripPem = (pem: string): Uint8Array => {
  const lines = pem.trim().split(/\r?\n/);
  // Remove header/footer lines and empty lines
  const body = lines
    .filter((l) => !l.includes('BEGIN ') && !l.includes('END ') && l.trim().length > 0)
    .join('');
  const bin = typeof window !== 'undefined'
    ? window.atob(body)
    : Buffer.from(body, 'base64').toString('binary');
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

const toBufferSource = (u8: Uint8Array): ArrayBuffer => {
  const copy = new Uint8Array(u8.byteLength);
  copy.set(u8);
  return copy.buffer;
};

export async function importPkcs8PrivateKey(pemPkcs8: string): Promise<CryptoKey> {
  const keyData = stripPem(pemPkcs8);
  const subtle = (globalThis as any)?.crypto?.subtle as SubtleCrypto | undefined;
  if (!subtle) throw new Error('WebCrypto SubtleCrypto is not available');
  return await subtle.importKey(
    'pkcs8',
    toBufferSource(keyData),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

export async function signJwtRs256(header: JwtHeader, payload: JwtPayload, privateKeyPem: string): Promise<string> {
  const h = { alg: 'RS256', typ: 'JWT', ...header };
  const headerB64 = base64urlEncode(JSON.stringify(h));
  const payloadB64 = base64urlEncode(JSON.stringify(payload));
  const data = textEncoder.encode(`${headerB64}.${payloadB64}`);
  const key = await importPkcs8PrivateKey(privateKeyPem);
  const subtle = (globalThis as any)?.crypto?.subtle as SubtleCrypto | undefined;
  if (!subtle) throw new Error('WebCrypto SubtleCrypto is not available');
  const sig = await subtle.sign('RSASSA-PKCS1-v1_5', key, data);
  const sigB64 = base64urlEncode(sig);
  return `${headerB64}.${payloadB64}.${sigB64}`;
}

function randomGuidLike(): string {
  // Simple UUIDv4-like generator using crypto.getRandomValues
  const rnd = new Uint8Array(16);
  const cryptoObj = (globalThis as any).crypto as Crypto | undefined;
  if (!cryptoObj || typeof cryptoObj.getRandomValues !== 'function') {
    // Fallback for environments without WebCrypto RNG
    for (let i = 0; i < rnd.length; i++) rnd[i] = Math.floor(Math.random() * 256);
  } else {
    cryptoObj.getRandomValues(rnd);
  }
  rnd[6] = (rnd[6] & 0x0f) | 0x40;
  rnd[8] = (rnd[8] & 0x3f) | 0x80;
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  const parts = Array.from(rnd, toHex).join('');
  return `${parts.slice(0,8)}-${parts.slice(8,12)}-${parts.slice(12,16)}-${parts.slice(16,20)}-${parts.slice(20)}`;
}

export async function buildClientAssertion(params: {
  clientId: string;
  tokenEndpoint: string;
  privateKeyPem: string;
  kid?: string;
  lifetimeSec?: number;
}): Promise<string> {
  const { clientId, tokenEndpoint, privateKeyPem, kid, lifetimeSec = 60 } = params;
  const now = Math.floor(Date.now() / 1000);
  const payload: JwtPayload = {
    iss: clientId,
    sub: clientId,
    aud: tokenEndpoint,
    jti: randomGuidLike(),
    iat: now,
    exp: now + lifetimeSec
  };
  const header: JwtHeader = kid ? { kid } : {};
  return await signJwtRs256(header, payload, privateKeyPem);
}
