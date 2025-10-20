"use client";
import {useEffect, useMemo, useRef, useState} from 'react';
import {useTranslations} from 'next-intl';

type Props = {
  // Inputs to derive expectations
  tenantId: string;
  clientId: string;
  expectedNonce: string;
  // Decoded JWT parts (pretty JSON strings)
  decodedAccessHeader: string;
  decodedAccessPayload: string;
  decodedIdHeader: string;
  decodedIdPayload: string;
  // Raw tokens (for signature verification)
  accessToken?: string;
  idToken?: string;
};

type JwtHeader = {
  alg?: string;
  kid?: string;
  typ?: string;
  [k: string]: any;
};
type JwtPayload = {
  iss?: string;
  aud?: string | string[];
  tid?: string;
  ver?: string;
  scp?: string; // space-separated scopes
  roles?: string[];
  nonce?: string;
  exp?: number;
  nbf?: number;
  iat?: number;
  sub?: string;
  [k: string]: any;
};

const parseJson = <T,>(s: string): T | undefined => {
  try {
    const obj = JSON.parse(s);
    if (obj && typeof obj === 'object') return obj as T;
  } catch {}
  return undefined;
};

const fmtEpoch = (v?: number) => {
  if (!v && v !== 0) return '';
  try {
    const d = new Date(v * 1000);
    return `${d.toLocaleString()} (${v})`;
  } catch {
    return String(v);
  }
};

const buildMetadataUrl = (iss?: string) => {
  if (!iss) return '';
  const base = iss.endsWith('/') ? iss.slice(0, -1) : iss;
  return `${base}/.well-known/openid-configuration`;
};

const guessJwksUrl = (iss?: string, tid?: string, ver?: string) => {
  if (!iss) return '';
  const u = new URL(iss);
  const host = u.host.toLowerCase();
  const tenant = (tid || 'common').trim();
  const v = (ver || (iss.includes('/v2.0') ? '2.0' : '1.0')).startsWith('2') ? 'v2.0' : 'v1.0';
  if (host.includes('login.microsoftonline.com') || host.includes('sts.windows.net')) {
    // Microsoft Entra ID
    // Keys are exposed via discovery/v2.0/keys; v1 also currently resolves via v2.0 endpoint
    return `https://login.microsoftonline.com/${tenant}/discovery/v2.0/keys`;
  }
  // Generic fallback: metadata.jwks_uri (user should fetch metadata)
  const meta = buildMetadataUrl(iss);
  return `${meta} -> jwks_uri`;
};

const ensureArray = (v: string | string[] | undefined): string[] =>
  Array.isArray(v) ? v : (typeof v === 'string' ? [v] : []);

// Helpers for signature verification
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
  // Create a new ArrayBuffer-backed copy to avoid SharedArrayBuffer typing issues
  const copy = new Uint8Array(u8.byteLength);
  copy.set(u8);
  return copy.buffer;
};

type SigStatus = {
  kid?: string;
  alg?: string;
  ver?: string;
  iss?: string;
  jwksUrl?: string;
  metadataUrl?: string;
  jwksFetched?: boolean;
  keyFound?: boolean;
  verified?: boolean;
  error?: string;
  reason?: string;
  publicKeyPem?: string;
};

const jwksCache: Record<string, any> = {};

async function getJwks(jwksUrl: string) {
  if (jwksCache[jwksUrl]) return jwksCache[jwksUrl];
  const res = await fetch(jwksUrl, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to fetch JWKS (${res.status})`);
  const json = await res.json();
  jwksCache[jwksUrl] = json;
  return json;
}

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

async function verifyJwtSignature(token: string, jwksUrl: string, expectedKid?: string): Promise<{ ok: boolean; keyFound: boolean; error?: string; reason?: string; alg?: string; kid?: string; ver?: string; iss?: string; publicKeyPem?: string; }>
{
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
    const ver = payload.ver;
    const iss = payload.iss;
    if (!alg || !alg.startsWith('RS')) return { ok: false, keyFound: false, error: `Unsupported alg ${alg}`, alg, kid, ver, iss };
    const jwks = await getJwks(jwksUrl);
    const keys: any[] = Array.isArray(jwks?.keys) ? jwks.keys : [];
    const jwk = keys.find((k) => k.kid === (expectedKid || kid));
    if (!jwk) return { ok: false, keyFound: false, error: 'Key not found in JWKS', reason: `kid ${(expectedKid || kid) || '(none)'} not present`, alg, kid, ver, iss };
    const subtle = window.crypto?.subtle;
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
    // Export SPKI for display as PEM public key
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

export default function StepValidate(props: Props) {
  const t = useTranslations('AuthorizationCode.PublicClient');
  const { tenantId, clientId, expectedNonce, decodedAccessHeader, decodedAccessPayload, decodedIdHeader, decodedIdPayload, accessToken, idToken } = props;

  const accessHeader = useMemo(() => parseJson<JwtHeader>(decodedAccessHeader) || {}, [decodedAccessHeader]);
  const accessPayload = useMemo(() => parseJson<JwtPayload>(decodedAccessPayload) || {}, [decodedAccessPayload]);
  const idHeader = useMemo(() => parseJson<JwtHeader>(decodedIdHeader) || {}, [decodedIdHeader]);
  const idPayload = useMemo(() => parseJson<JwtPayload>(decodedIdPayload) || {}, [decodedIdPayload]);

  const accIss = accessPayload.iss;
  const idIss = idPayload.iss;
  const accMeta = buildMetadataUrl(accIss);
  const idMeta = buildMetadataUrl(idIss);
  const accJwks = guessJwksUrl(accIss, accessPayload.tid, accessPayload.ver);
  const idJwks = guessJwksUrl(idIss, idPayload.tid, idPayload.ver);

  const expectedScopes = useMemo(() => {
    // We don't know which scopes the app expects here; show what the token has.
    const scp = (accessPayload.scp || '').trim();
    return scp ? scp.split(/\s+/) : [];
  }, [accessPayload.scp]);

  // Signature verification status
  const [idSig, setIdSig] = useState<SigStatus>({});
  const [accSig, setAccSig] = useState<SigStatus>({});

  const idJwksUrlResolvedRef = useRef<string | undefined>(undefined);
  const accJwksUrlResolvedRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    // ID token signature verification
    (async () => {
      const s: SigStatus = {
        kid: idHeader.kid,
        alg: idHeader.alg,
        ver: idPayload.ver,
        iss: idIss,
        metadataUrl: idMeta,
        jwksUrl: undefined,
        jwksFetched: false,
        keyFound: false,
        verified: false
      };
      try {
        if (!idToken || !idIss) { setIdSig(s); return; }
        let jwksUrl = '';
        const host = (() => { try { return new URL(idIss!).host.toLowerCase(); } catch { return ''; } })();
        if (host.includes('login.microsoftonline.com') || host.includes('sts.windows.net')) {
          // Try v2 then v1
          const tenant = (idPayload.tid || 'common').trim();
          const candidates = [
            `https://login.microsoftonline.com/${tenant}/discovery/v2.0/keys`,
            `https://login.microsoftonline.com/${tenant}/discovery/keys`
          ];
          for (const url of candidates) {
            try {
              const result = await verifyJwtSignature(idToken, url, idHeader.kid);
              s.jwksUrl = url;
              s.jwksFetched = true;
              s.keyFound = result.keyFound;
              s.verified = !!result.ok;
              if (result.error) s.error = result.error;
              if (result.reason) s.reason = result.reason;
              if (result.publicKeyPem) s.publicKeyPem = result.publicKeyPem;
              if (result.ok) break;
            } catch (e: any) {
              s.error = String(e);
            }
          }
        } else if (idMeta && !idMeta.includes('->')) {
          try {
            const res = await fetch(idMeta, { cache: 'no-store' });
            const json = await res.json();
            if (json && typeof json === 'object' && json.jwks_uri) jwksUrl = String(json.jwks_uri);
          } catch {}
        }
        if (!s.jwksUrl) {
          s.jwksUrl = jwksUrl || idJwks;
          idJwksUrlResolvedRef.current = s.jwksUrl;
          if (s.jwksUrl) {
            s.jwksFetched = true;
            const result = await verifyJwtSignature(idToken, s.jwksUrl, idHeader.kid);
            s.keyFound = result.keyFound;
            s.verified = !!result.ok;
            if (result.error) s.error = result.error;
            if (result.reason) s.reason = result.reason;
            if (result.publicKeyPem) s.publicKeyPem = result.publicKeyPem;
          }
        }
      } catch (e: any) {
        s.error = String(e);
      }
      setIdSig(s);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idToken, idHeader.kid, idHeader.alg, idPayload.tid, idIss]);

  useEffect(() => {
    // Access token signature verification
    (async () => {
      const s: SigStatus = {
        kid: accessHeader.kid,
        alg: accessHeader.alg,
        ver: accessPayload.ver,
        iss: accIss,
        metadataUrl: accMeta,
        jwksUrl: undefined,
        jwksFetched: false,
        keyFound: false,
        verified: false
      };
      try {
        if (!accessToken || !accIss) { setAccSig(s); return; }
        let jwksUrl = '';
        const host = (() => { try { return new URL(accIss!).host.toLowerCase(); } catch { return ''; } })();
        if (host.includes('login.microsoftonline.com') || host.includes('sts.windows.net')) {
          // Try v2 then v1
          const tenant = (accessPayload.tid || 'common').trim();
          const candidates = [
            `https://login.microsoftonline.com/${tenant}/discovery/v2.0/keys`,
            `https://login.microsoftonline.com/${tenant}/discovery/keys`
          ];
          for (const url of candidates) {
            try {
              const result = await verifyJwtSignature(accessToken, url, accessHeader.kid);
              s.jwksUrl = url;
              s.jwksFetched = true;
              s.keyFound = result.keyFound;
              s.verified = !!result.ok;
              if (result.error) s.error = result.error;
              if (result.reason) s.reason = result.reason;
              if (result.publicKeyPem) s.publicKeyPem = result.publicKeyPem;
              if (result.ok) break;
            } catch (e: any) {
              s.error = String(e);
            }
          }
        } else if (accMeta && !accMeta.includes('->')) {
          try {
            const res = await fetch(accMeta, { cache: 'no-store' });
            const json = await res.json();
            if (json && typeof json === 'object' && json.jwks_uri) jwksUrl = String(json.jwks_uri);
          } catch {}
        }
        if (!s.jwksUrl) {
          s.jwksUrl = jwksUrl || accJwks;
          accJwksUrlResolvedRef.current = s.jwksUrl;
          if (s.jwksUrl) {
            s.jwksFetched = true;
            const result = await verifyJwtSignature(accessToken, s.jwksUrl, accessHeader.kid);
            s.keyFound = result.keyFound;
            s.verified = !!result.ok;
            if (result.error) s.error = result.error;
            if (result.reason) s.reason = result.reason;
            if (result.publicKeyPem) s.publicKeyPem = result.publicKeyPem;
          }
        }
      } catch (e: any) {
        s.error = String(e);
      }
      setAccSig(s);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, accessHeader.kid, accessHeader.alg, accessPayload.tid, accIss]);

  const StatusIcon = ({ ok, label }: { ok: boolean | undefined; label?: string }) => (
    <span style={{ color: ok ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
      <i className={`pi ${ok ? 'pi-check' : 'pi-times'}`} style={{ marginRight: 6 }} />
      {label}
    </span>
  );

  // Server-side diagnostics removed per request.

  // Claim validation checks
  const nowSec = Math.floor(Date.now() / 1000);
  const skewSec = 300; // 5 minutes clock skew tolerance

  const idClaimOk = useMemo(() => {
    const aud = String(idPayload.aud ?? '');
    const audOk = clientId ? aud === clientId : !!aud; // if no expected, require presence
    const issOk = tenantId
      ? (idPayload.tid === tenantId || (idIss?.includes(tenantId) ?? false))
      : !!idIss;
    const nonceOk = expectedNonce ? idPayload.nonce === expectedNonce : true; // not required if not sent
    const tidOk = tenantId ? idPayload.tid === tenantId : !!idPayload.tid;
    const subOk = !!idPayload.sub;
    const expOk = typeof idPayload.exp === 'number' ? idPayload.exp > (nowSec - skewSec) : false;
    const nbfOk = typeof idPayload.nbf === 'number' ? idPayload.nbf <= (nowSec + skewSec) : true; // ok if missing
    const iatOk = typeof idPayload.iat === 'number' ? idPayload.iat <= (nowSec + skewSec) : true; // ok if missing
    return { audOk, issOk, nonceOk, tidOk, subOk, expOk, nbfOk, iatOk };
  }, [clientId, expectedNonce, idIss, idPayload.aud, idPayload.exp, idPayload.iat, idPayload.nbf, idPayload.nonce, idPayload.sub, idPayload.tid, nowSec, skewSec, tenantId]);

  const accClaimOk = useMemo(() => {
    const aud = String(accessPayload.aud ?? '');
    const audOk = !!aud; // without expected API audience, require presence
    const issOk = tenantId
      ? (accessPayload.tid === tenantId || (accIss?.includes(tenantId) ?? false))
      : !!accIss;
    const tidOk = tenantId ? accessPayload.tid === tenantId : !!accessPayload.tid;
    const scopesPresent = (accessPayload.scp && accessPayload.scp.trim().length > 0) || (Array.isArray(accessPayload.roles) && accessPayload.roles.length > 0);
    const scopesOk = !!scopesPresent; // require some permissions present
    const expOk = typeof accessPayload.exp === 'number' ? accessPayload.exp > (nowSec - skewSec) : false;
    const nbfOk = typeof accessPayload.nbf === 'number' ? accessPayload.nbf <= (nowSec + skewSec) : true;
    const iatOk = typeof accessPayload.iat === 'number' ? accessPayload.iat <= (nowSec + skewSec) : true;
    return { audOk, issOk, tidOk, scopesOk, expOk, nbfOk, iatOk };
  }, [accessPayload.aud, accessPayload.exp, accessPayload.iat, accessPayload.nbf, accessPayload.roles, accessPayload.scp, accessPayload.tid, accIss, nowSec, skewSec, tenantId]);

  return (
    <section>
      <h3 className="mt-0 mb-3">{t('sections.validate.title')}</h3>
      <p className="mb-3">{t('sections.validate.description')}</p>

      {/* ID Token section */}
      <div className="mb-5">
        <h4 className="mt-3">ID Token</h4>
        <h5 className="mt-2">Signature validation {typeof idSig.verified === 'boolean' && (
          <span className="ml-2"><StatusIcon ok={!!idSig.verified} label={idSig.verified ? 'Verified' : 'Not verified'} /></span>
        )}</h5>
        <ol>
          <li>Extract kid from token header: <code>{idHeader.kid || '—'}</code> <span className="ml-2"><StatusIcon ok={!!idHeader.kid} /></span></li>
          <li>Extract alg from token header: <code>{idHeader.alg || '—'}</code> <span className="ml-2"><StatusIcon ok={!!idHeader.alg && idHeader.alg.startsWith('RS')} /></span></li>
          <li>Extract version from token payload: <code>{idPayload.ver || (idIss?.includes('/v2.0') ? '2.0 (from iss)' : '1.0?')}</code> <span className="ml-2"><StatusIcon ok={true} /></span></li>
          <li>Extract issuer (iss) from token payload: <code>{idIss || '—'}</code> <span className="ml-2"><StatusIcon ok={!!idIss} /></span></li>
          <li>Build metadata endpoint: <code>{idMeta || '—'}</code> <span className="ml-2"><StatusIcon ok={!!idMeta} /></span></li>
          <li>Resolve JWKS URL: <code>{idSig.jwksUrl || idJwks || '—'}</code> <span className="ml-2"><StatusIcon ok={!!(idSig.jwksUrl || idJwks)} /></span></li>
          <li>Fetch JWKS and find key <code>{idHeader.kid || '—'}</code> <span className="ml-2"><StatusIcon ok={idSig.keyFound} /></span></li>
          <li>Verify signature with alg <code>{idHeader.alg || '—'}</code> <span className="ml-2"><StatusIcon ok={idSig.verified} /></span></li>
        </ol>
  {idSig.reason && <p className="mt-2" style={{ color: idSig.verified ? '#16a34a' : '#dc2626' }}>Reason: {idSig.reason}</p>}
  {idSig.error && <p style={{ color: '#dc2626' }}>Error: {idSig.error}</p>}
        {idSig.publicKeyPem && (
          <details className="mt-2">
            <summary>Public key (PEM)</summary>
            <div className="flex align-items-center gap-2 mb-2">
              <button className="p-button p-button-text p-button-sm" onClick={async (e) => { e.preventDefault(); try { await navigator.clipboard.writeText(idSig.publicKeyPem!); } catch {} }}>Copy</button>
            </div>
            <pre style={{ whiteSpace: 'pre-wrap' }}>{idSig.publicKeyPem}</pre>
          </details>
        )}
        <h5 className="mt-3">Claim validations</h5>
        <ul>
          <li>
            aud should equal your client_id: <code>{String(idPayload.aud)}</code> {clientId ? `(expected ${clientId})` : ''}
            <span className="ml-2"><StatusIcon ok={idClaimOk.audOk} /></span>
          </li>
          <li>
            iss should match your authority/tenant: <code>{idPayload.iss || '—'}</code> {tenantId ? `(tenant ${tenantId})` : ''}
            <span className="ml-2"><StatusIcon ok={idClaimOk.issOk} /></span>
          </li>
          <li>
            nonce should match request: <code>{idPayload.nonce || '—'}</code> {expectedNonce ? `(expected ${expectedNonce})` : ''}
            <span className="ml-2"><StatusIcon ok={idClaimOk.nonceOk} /></span>
          </li>
          <li>
            tid (tenant) present/matches: <code>{idPayload.tid || '—'}</code> {tenantId ? `(expected ${tenantId})` : ''}
            <span className="ml-2"><StatusIcon ok={idClaimOk.tidOk} /></span>
          </li>
          <li>
            sub present: <code>{idPayload.sub || '—'}</code>
            <span className="ml-2"><StatusIcon ok={idClaimOk.subOk} /></span>
          </li>
          <li>
            exp in future: <code>{fmtEpoch(idPayload.exp)}</code>
            <span className="ml-2"><StatusIcon ok={idClaimOk.expOk} /></span>
          </li>
          <li>
            nbf/iat reasonable: nbf <code>{fmtEpoch(idPayload.nbf)}</code>, iat <code>{fmtEpoch(idPayload.iat)}</code>
            <span className="ml-2"><StatusIcon ok={idClaimOk.nbfOk && idClaimOk.iatOk} /></span>
          </li>
        </ul>
        {/* Diagnostics UI removed */}
      </div>

      {/* Access Token section */}
      <div>
        <h4 className="mt-3">Access Token</h4>
        <h5 className="mt-2">Signature validation {typeof accSig.verified === 'boolean' && (
          <span className="ml-2"><StatusIcon ok={!!accSig.verified} label={accSig.verified ? 'Verified' : 'Not verified'} /></span>
        )}</h5>
        <ol>
          <li>Extract kid from token header: <code>{accessHeader.kid || '—'}</code> <span className="ml-2"><StatusIcon ok={!!accessHeader.kid} /></span></li>
          <li>Extract alg from token header: <code>{accessHeader.alg || '—'}</code> <span className="ml-2"><StatusIcon ok={!!accessHeader.alg && accessHeader.alg.startsWith('RS')} /></span></li>
          <li>Extract version from token payload: <code>{accessPayload.ver || (accIss?.includes('/v2.0') ? '2.0 (from iss)' : '1.0?')}</code> <span className="ml-2"><StatusIcon ok={true} /></span></li>
          <li>Extract issuer (iss) from token payload: <code>{accIss || '—'}</code> <span className="ml-2"><StatusIcon ok={!!accIss} /></span></li>
          <li>Build metadata endpoint: <code>{accMeta || '—'}</code> <span className="ml-2"><StatusIcon ok={!!accMeta} /></span></li>
          <li>Resolve JWKS URL: <code>{accSig.jwksUrl || accJwks || '—'}</code> <span className="ml-2"><StatusIcon ok={!!(accSig.jwksUrl || accJwks)} /></span></li>
          <li>Fetch JWKS and find key <code>{accessHeader.kid || '—'}</code> <span className="ml-2"><StatusIcon ok={accSig.keyFound} /></span></li>
          <li>Verify signature with alg <code>{accessHeader.alg || '—'}</code> <span className="ml-2"><StatusIcon ok={accSig.verified} /></span></li>
        </ol>
  {accSig.reason && <p className="mt-2" style={{ color: accSig.verified ? '#16a34a' : '#dc2626' }}>Reason: {accSig.reason}</p>}
  {accSig.error && <p style={{ color: '#dc2626' }}>Error: {accSig.error}</p>}
        {accSig.publicKeyPem && (
          <details className="mt-2">
            <summary>Public key (PEM)</summary>
            <div className="flex align-items-center gap-2 mb-2">
              <button className="p-button p-button-text p-button-sm" onClick={async (e) => { e.preventDefault(); try { await navigator.clipboard.writeText(accSig.publicKeyPem!); } catch {} }}>Copy</button>
            </div>
            <pre style={{ whiteSpace: 'pre-wrap' }}>{accSig.publicKeyPem}</pre>
          </details>
        )}
        <h5 className="mt-3">Claim validations</h5>
        <ul>
          <li>
            aud should equal API/resource: <code>{String(accessPayload.aud)}</code>
            <span className="ml-2"><StatusIcon ok={accClaimOk.audOk} /></span>
          </li>
          <li>
            iss should match your tenant issuer: <code>{accessPayload.iss || '—'}</code> {tenantId ? `(tenant ${tenantId})` : ''}
            <span className="ml-2"><StatusIcon ok={accClaimOk.issOk} /></span>
          </li>
          <li>
            tid (tenant) present/matches: <code>{accessPayload.tid || '—'}</code> {tenantId ? `(expected ${tenantId})` : ''}
            <span className="ml-2"><StatusIcon ok={accClaimOk.tidOk} /></span>
          </li>
          <li>
            Scopes/roles include what you need: scp <code>{accessPayload.scp || '—'}</code> roles <code>{ensureArray(accessPayload.roles).join(', ') || '—'}</code>
            <span className="ml-2"><StatusIcon ok={accClaimOk.scopesOk} /></span>
          </li>
          <li>
            exp in future: <code>{fmtEpoch(accessPayload.exp)}</code>
            <span className="ml-2"><StatusIcon ok={accClaimOk.expOk} /></span>
          </li>
          <li>
            nbf/iat reasonable: nbf <code>{fmtEpoch(accessPayload.nbf)}</code>, iat <code>{fmtEpoch(accessPayload.iat)}</code>
            <span className="ml-2"><StatusIcon ok={accClaimOk.nbfOk && accClaimOk.iatOk} /></span>
          </li>
        </ul>
        {/* Diagnostics UI removed */}
      </div>
    </section>
  );
}
