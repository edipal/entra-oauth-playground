import { decodeJwt as joseDecodeJwt, decodeProtectedHeader } from 'jose';

export const decodeJwt = (token: string) => {
  try {
    const header = decodeProtectedHeader(token);
    const payload = joseDecodeJwt(token);
    return {
      header: JSON.stringify(header, null, 2),
      payload: JSON.stringify(payload, null, 2)
    };
  } catch {
    return { header: '', payload: '' };
  }
};
