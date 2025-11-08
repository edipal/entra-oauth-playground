// Random and entropy helpers centralizing all crypto.getRandomValues usage.
// Safe for browser environments. Falls back to Math.random only if WebCrypto unavailable.

export function randomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  const cryptoObj = (globalThis as any).crypto as Crypto | undefined;
  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    cryptoObj.getRandomValues(out);
  } else {
    // Weak fallback; caller should avoid relying on cryptographic strength in this branch.
    for (let i = 0; i < length; i++) out[i] = Math.floor(Math.random() * 256);
  }
  return out;
}

// URL-safe base64-ish charset for state/nonce per OAuth recommendations (no padding).
const URL_SAFE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_' as const;

export function randomUrlSafeString(length = 32): string {
  const rnd = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += URL_SAFE[rnd[i] % URL_SAFE.length];
  return out;
}

// UUIDv4-like helper (used for jti) preserved from previous inline implementation.
export function randomGuidLike(): string {
  const rnd = randomBytes(16);
  rnd[6] = (rnd[6] & 0x0f) | 0x40; // version 4
  rnd[8] = (rnd[8] & 0x3f) | 0x80; // variant
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  const parts = Array.from(rnd, toHex).join('');
  return `${parts.slice(0,8)}-${parts.slice(8,12)}-${parts.slice(12,16)}-${parts.slice(16,20)}-${parts.slice(20)}`;
}
