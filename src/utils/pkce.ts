export const base64UrlEncode = (input: ArrayBuffer) => {
  const bytes = new Uint8Array(input);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  const b64 = typeof window !== 'undefined' ? window.btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

export const randomCodeVerifier = (length = 96) => {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const random = new Uint8Array(length);
  crypto.getRandomValues(random);
  let result = '';
  for (let i = 0; i < length; i++) result += charset[random[i] % charset.length];
  return result;
};

export const computeS256Challenge = async (verifier: string) => {
  const enc = new TextEncoder();
  const data = enc.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(digest);
};
