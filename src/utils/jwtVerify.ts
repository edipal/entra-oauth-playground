// JWT verification utilities using Web Crypto for RSASSA-PKCS1-v1_5 with SHA-256.
// Includes helpers for OIDC metadata/JWKS resolution.

export type JwtHeader = {
  alg?: string;
  kid?: string;
  typ?: string;
  [k: string]: any;
};
export type JwtPayload = {
  iss?: string;
  aud?: string | string[];
  tid?: string;
  ver?: string;
  [k: string]: any;
};

export type VerifyResult = {
  ok: boolean;
  keyFound: boolean;
  error?: string;
  reason?: string;
  alg?: string;
  kid?: string;
  ver?: string;
  iss?: string;
  publicKeyPem?: string;
};

const jwksCache: Record<string, any> = {};

export const buildMetadataUrl = (iss?: string) => {
  if (!iss) return '';
  try {
    const base = iss.endsWith('/') ? iss.slice(0, -1) : iss;
    return `${base}/.well-known/openid-configuration`;
  } catch {
    return '';
  }
};

export const guessJwksUrl = (iss?: string, tid?: string, ver?: string) => {
  if (!iss) return '';
  try {
    const u = new URL(iss);
    const host = u.host.toLowerCase();
    const tenant = (tid || 'common').trim();
    const v = (ver || (iss.includes('/v2.0') ? '2.0' : '1.0')).startsWith('2') ? 'v2.0' : 'v1.0';
    if (host.includes('login.microsoftonline.com') || host.includes('sts.windows.net')) {
      return `https://login.microsoftonline.com/${tenant}/discovery/v2.0/keys`;
    }
  } catch {}
  const meta = buildMetadataUrl(iss);
  return `${meta} -> jwks_uri`;
};

async function getJwks(jwksUrl: string) {
  if (jwksCache[jwksUrl]) return jwksCache[jwksUrl];
  const res = await fetch(jwksUrl, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to fetch JWKS (${res.status})`);
  const json = await res.json();
  jwksCache[jwksUrl] = json;
  return json;
}

const b64urlToBytes = (b64url: string): Uint8Array => {
  let b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4;
  if (pad === 2) b64 += '==';
  else if (pad === 3) b64 += '=';
  const bin = typeof window !== 'undefined' ? window.atob(b64) : Buffer.from(b64, 'base64').toString('binary');
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

const toBufferSource = (u8: Uint8Array): ArrayBuffer => {
  const copy = new Uint8Array(u8.byteLength);
  copy.set(u8);
  return copy.buffer;
};

const abToBase64 = (ab: ArrayBuffer) => {
  const u8 = new Uint8Array(ab);
  let bin = '';
  for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
  return typeof window !== 'undefined' ? window.btoa(bin) : Buffer.from(u8).toString('base64');
};

const toPemPublicKey = (spki: ArrayBuffer) => {
  const b64 = abToBase64(spki);
  const lines = b64.match(/.{1,64}/g) || [b64];
  return `-----BEGIN PUBLIC KEY-----\n${lines.join('\n')}\n-----END PUBLIC KEY-----`;
};

export async function verifyJwtSignature(token: string, jwksUrl: string, expectedKid?: string): Promise<VerifyResult> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return { ok: false, keyFound: false, error: 'Not a JWT' };
    const [h, p, s] = parts;
    const headerStr = new TextDecoder().decode(b64urlToBytes(h));
    const payloadStr = new TextDecoder().decode(b64urlToBytes(p));
    const header = JSON.parse(headerStr) as JwtHeader;
    const payload = JSON.parse(payloadStr) as JwtPayload;
    const alg = header.alg;
    const kid = header.kid;
    const ver = (payload as any).ver as string | undefined;
    const iss = payload.iss;
    if (!alg || !alg.startsWith('RS')) return { ok: false, keyFound: false, error: `Unsupported alg ${alg}`, alg, kid, ver, iss };
    const jwks = await getJwks(jwksUrl);
    const keys: any[] = Array.isArray(jwks?.keys) ? jwks.keys : [];
    const jwk = keys.find((k) => k.kid === (expectedKid || kid));
    if (!jwk) return { ok: false, keyFound: false, error: 'Key not found in JWKS', reason: `kid ${(expectedKid || kid) || '(none)'} not present`, alg, kid, ver, iss };
    const subtle = (globalThis as any)?.crypto?.subtle as SubtleCrypto | undefined;
    if (!subtle) return { ok: false, keyFound: true, error: 'WebCrypto not available', reason: 'no SubtleCrypto', alg, kid, ver, iss };
    const key = await subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      true,
      ['verify']
    );
    const data = new TextEncoder().encode(`${h}.${p}`);
    const sig = b64urlToBytes(s);
    let publicKeyPem: string | undefined = undefined;
    try {
      const spki = await subtle.exportKey('spki', key);
      publicKeyPem = toPemPublicKey(spki);
    } catch {
      // ignore export errors
    }
    const ok = await subtle.verify('RSASSA-PKCS1-v1_5', key, toBufferSource(sig), toBufferSource(data));
    return { ok, keyFound: true, alg, kid, ver, iss, publicKeyPem };
  } catch (e: any) {
    return { ok: false, keyFound: false, error: String(e), reason: 'exception during verify' } as any;
  }
}
