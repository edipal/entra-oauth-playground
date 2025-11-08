// JWT decoding helpers (no signature validation). Intended for UI/debug purposes.
// Renamed from jwt.ts to clarify that this file only decodes (does not sign/verify).

export const base64UrlDecodeToString = (b64url: string) => {
  try {
    let b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4;
    if (pad === 2) b64 += '==';
    else if (pad === 3) b64 += '=';
    const binary = typeof window !== 'undefined' ? window.atob(b64) : Buffer.from(b64, 'base64').toString('binary');
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  } catch {
    return '';
  }
};

export const decodeJwt = (token: string) => {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return { header: '', payload: '' };
    const headerStr = base64UrlDecodeToString(parts[0]);
    const payloadStr = base64UrlDecodeToString(parts[1]);
    const pretty = (s: string) => {
      try {
        return JSON.stringify(JSON.parse(s), null, 2);
      } catch {
        return s || '';
      }
    };
    return { header: pretty(headerStr), payload: pretty(payloadStr) };
  } catch {
    return { header: '', payload: '' };
  }
};
