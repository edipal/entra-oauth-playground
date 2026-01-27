"use client";
import {useEffect, useMemo, useRef, useState} from 'react';
import {useTranslations} from 'next-intl';
import { buildMetadataUrl, guessJwksUrl, verifyJwtSignature } from '@/lib/jwtVerify';

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


const ensureArray = (v: string | string[] | undefined): string[] =>
  Array.isArray(v) ? v : (typeof v === 'string' ? [v] : []);


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


export default function StepValidate(props: Props) {
  const t = useTranslations('StepValidate');
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
        // Skip signature verification for Microsoft Graph access tokens
        const skipGraph = String(accessPayload.aud || '') === '00000003-0000-0000-c000-000000000000';
        if (skipGraph) { setAccSig({}); return; }
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
    const expOk = typeof idPayload.exp === 'number' ? idPayload.exp > (nowSec - skewSec) : false;
    const nbfOk = typeof idPayload.nbf === 'number' ? idPayload.nbf <= (nowSec + skewSec) : true; // ok if missing
    const iatOk = typeof idPayload.iat === 'number' ? idPayload.iat <= (nowSec + skewSec) : true; // ok if missing
    return { audOk, issOk, nonceOk, expOk, nbfOk, iatOk };
  }, [clientId, expectedNonce, idIss, idPayload.aud, idPayload.exp, idPayload.iat, idPayload.nbf, idPayload.nonce, nowSec, skewSec, tenantId]);

  const accClaimOk = useMemo(() => {
    const aud = String(accessPayload.aud ?? '');
    const audOk = !!aud; // without expected API audience, require presence
    const issOk = tenantId
      ? (accessPayload.tid === tenantId || (accIss?.includes(tenantId) ?? false))
      : !!accIss;
    // For client credentials we cannot validate scopes without knowing granted app permissions.
    // Mark scopes as "not validated" but do not fail if missing.
    const scopesOk = true;
    const expOk = typeof accessPayload.exp === 'number' ? accessPayload.exp > (nowSec - skewSec) : false;
    const nbfOk = typeof accessPayload.nbf === 'number' ? accessPayload.nbf <= (nowSec + skewSec) : true;
    const iatOk = typeof accessPayload.iat === 'number' ? accessPayload.iat <= (nowSec + skewSec) : true;
    return { audOk, issOk, scopesOk, expOk, nbfOk, iatOk };
  }, [accessPayload.aud, accessPayload.exp, accessPayload.iat, accessPayload.nbf, accessPayload.tid, accIss, nowSec, skewSec, tenantId]);

  // Show a warning when validating Microsoft Graph access tokens: only Graph can verify its signatures
  const graphAud = '00000003-0000-0000-c000-000000000000';
  const graphAudUrl = 'https://graph.microsoft.com';
  const accessAudiences = ensureArray(accessPayload.aud as any);
  const isGraphAccessToken = accessAudiences.some((aud) => {
    const normalized = String(aud || '').trim().replace(/\/$/, '');
    return normalized === graphAud || normalized === graphAudUrl;
  });
  const isClientCredentials = String(accessPayload.idtyp || '').toLowerCase() === 'app' || !idToken;

  return (
    <section>
      <h3 className="mt-0 mb-3">{t('sections.validate.title')}</h3>
      <p className="mb-3">{t('sections.validate.description')}</p>
      {isGraphAccessToken && (
        <div className="mt-2 flex gap-3 align-items-start pl-2">
          <i
            className="pi pi-exclamation-circle mr-2"
            style={{ color: 'var(--yellow-500)', fontSize: '1.1rem', marginTop: '0.2rem' }}
            aria-hidden="true"
          />
          <p className="m-0 text-sm">
            {(t as any).rich('validateUi.graphWarning', {
              code: (chunks: any) => <code>{chunks}</code>,
              aud: graphAud
            })}
          </p>
        </div>
      )}

      {/* ID Token section */}
      {!!idToken && (
        <div className="mb-5">
          <h4 className="mt-3">{t('validateUi.idTokenTitle')}</h4>
          <h5 className="mt-2">{t('validateUi.signatureValidation')} {typeof idSig.verified === 'boolean' && (
            <span className="ml-2"><StatusIcon ok={!!idSig.verified} label={idSig.verified ? t('validateUi.verified') : t('validateUi.notVerified')} /></span>
          )}</h5>
          <ol>
            <li>{t('validateUi.steps.extractKid')} <code>{idHeader.kid || '—'}</code> <span className="ml-2"><StatusIcon ok={!!idHeader.kid} /></span></li>
            <li>{t('validateUi.steps.extractAlg')} <code>{idHeader.alg || '—'}</code> <span className="ml-2"><StatusIcon ok={!!idHeader.alg && idHeader.alg.startsWith('RS')} /></span></li>
            <li>{t('validateUi.steps.extractVersion')} <code>{idPayload.ver || (idIss?.includes('/v2.0') ? '2.0 (from iss)' : '1.0?')}</code> <span className="ml-2"><StatusIcon ok={true} /></span></li>
            <li>{t('validateUi.steps.extractIssuer')} <code>{idIss || '—'}</code> <span className="ml-2"><StatusIcon ok={!!idIss} /></span></li>
            <li>{t('validateUi.steps.buildMetadata')} <code>{idMeta || '—'}</code> <span className="ml-2"><StatusIcon ok={!!idMeta} /></span></li>
            <li>{t('validateUi.steps.resolveJwks')} <code>{idSig.jwksUrl || idJwks || '—'}</code> <span className="ml-2"><StatusIcon ok={!!(idSig.jwksUrl || idJwks)} /></span></li>
            <li>{t('validateUi.steps.fetchJwksFindKey')} <code>{idHeader.kid || '—'}</code> <span className="ml-2"><StatusIcon ok={idSig.keyFound} /></span></li>
            <li>{t('validateUi.steps.verifySignature')} <code>{idHeader.alg || '—'}</code> <span className="ml-2"><StatusIcon ok={idSig.verified} /></span></li>
          </ol>
          {idSig.reason && <p className="mt-2" style={{ color: idSig.verified ? '#16a34a' : '#dc2626' }}>{t('validateUi.reason')} {idSig.reason}</p>}
          {idSig.error && <p style={{ color: '#dc2626' }}>{t('validateUi.error')} {idSig.error}</p>}
          {idSig.publicKeyPem && (
            <details className="mt-2">
              <summary>{t('validateUi.publicKeyPem')}</summary>
              <div className="flex align-items-center gap-2 mb-2">
                <button className="p-button p-button-text p-button-sm" onClick={async (e) => { e.preventDefault(); try { await navigator.clipboard.writeText(idSig.publicKeyPem!); } catch {} }}>{t('validateUi.copy')}</button>
              </div>
              <pre style={{ whiteSpace: 'pre-wrap' }}>{idSig.publicKeyPem}</pre>
            </details>
          )}
          <h5 className="mt-3">{t('validateUi.claimValidations')}</h5>
          <ul>
            <li>
              {t('validateUi.claims.id.aud')} <code>{String(idPayload.aud)}</code> {clientId ? `(expected ${clientId})` : ''}
              <span className="ml-2"><StatusIcon ok={idClaimOk.audOk} /></span>
            </li>
            <li>
              {t('validateUi.claims.id.iss')} <code>{idPayload.iss || '—'}</code> {tenantId ? `(tenant ${tenantId})` : ''}
              <span className="ml-2"><StatusIcon ok={idClaimOk.issOk} /></span>
            </li>
            <li>
              {t('validateUi.claims.id.exp')} <code>{fmtEpoch(idPayload.exp)}</code>
              <span className="ml-2"><StatusIcon ok={idClaimOk.expOk} /></span>
            </li>
            <li>
              {t('validateUi.claims.id.nbfIat')}: nbf <code>{fmtEpoch(idPayload.nbf)}</code>, iat <code>{fmtEpoch(idPayload.iat)}</code>
              <span className="ml-2"><StatusIcon ok={idClaimOk.nbfOk && idClaimOk.iatOk} /></span>
            </li>
            <li>
              {t('validateUi.claims.id.nonce')} <code>{idPayload.nonce || '—'}</code> {expectedNonce ? `(expected ${expectedNonce})` : ''}
              <span className="ml-2"><StatusIcon ok={idClaimOk.nonceOk} /></span>
            </li>
          </ul>
          {/* Diagnostics UI removed */}
        </div>
      )}

      {/* Access Token section */}
      <div>
        <h4 className="mt-3">{t('validateUi.accessTokenTitle')}</h4>
        <h5 className="mt-2">{t('validateUi.signatureValidation')} {isGraphAccessToken ? (
          <span className="ml-2" style={{ color: 'var(--yellow-500)' }}>
            <span className="pi pi-forward mr-2" aria-label={t('validateUi.skippedAria')} />
            {t('validateUi.skipped')}
          </span>
        ) : (
          typeof accSig.verified === 'boolean' && (
            <span className="ml-2"><StatusIcon ok={!!accSig.verified} label={accSig.verified ? t('validateUi.verified') : t('validateUi.notVerified')} /></span>
          )
        )}</h5>
        {!isGraphAccessToken && (
          <>
            <ol>
              <li>{t('validateUi.steps.extractKid')} <code>{accessHeader.kid || '—'}</code> <span className="ml-2"><StatusIcon ok={!!accessHeader.kid} /></span></li>
              <li>{t('validateUi.steps.extractAlg')} <code>{accessHeader.alg || '—'}</code> <span className="ml-2"><StatusIcon ok={!!accessHeader.alg && accessHeader.alg.startsWith('RS')} /></span></li>
              <li>{t('validateUi.steps.extractVersion')} <code>{accessPayload.ver || (accIss?.includes('/v2.0') ? '2.0 (from iss)' : '1.0?')}</code> <span className="ml-2"><StatusIcon ok={true} /></span></li>
              <li>{t('validateUi.steps.extractIssuer')} <code>{accIss || '—'}</code> <span className="ml-2"><StatusIcon ok={!!accIss} /></span></li>
              <li>{t('validateUi.steps.buildMetadata')} <code>{accMeta || '—'}</code> <span className="ml-2"><StatusIcon ok={!!accMeta} /></span></li>
              <li>{t('validateUi.steps.resolveJwks')} <code>{accSig.jwksUrl || accJwks || '—'}</code> <span className="ml-2"><StatusIcon ok={!!(accSig.jwksUrl || accJwks)} /></span></li>
              <li>{t('validateUi.steps.fetchJwksFindKey')} <code>{accessHeader.kid || '—'}</code> <span className="ml-2"><StatusIcon ok={accSig.keyFound} /></span></li>
              <li>
                {t('validateUi.steps.verifySignature')} <code>{accessHeader.alg || '—'}</code> <span className="ml-2"><StatusIcon ok={accSig.verified} /></span>
              </li>
            </ol>
            {accSig.reason && (
              <p className="mt-2" style={{ color: accSig.verified ? '#16a34a' : '#dc2626' }}>
                {t('validateUi.reason')} {accSig.reason}
              </p>
            )}
            {accSig.error && <p style={{ color: '#dc2626' }}>{t('validateUi.error')} {accSig.error}</p>}
            {accSig.publicKeyPem && (
              <details className="mt-2">
                <summary>{t('validateUi.publicKeyPem')}</summary>
                <div className="flex align-items-center gap-2 mb-2">
                  <button className="p-button p-button-text p-button-sm" onClick={async (e) => { e.preventDefault(); try { await navigator.clipboard.writeText(accSig.publicKeyPem!); } catch {} }}>{t('validateUi.copy')}</button>
                </div>
                <pre style={{ whiteSpace: 'pre-wrap' }}>{accSig.publicKeyPem}</pre>
              </details>
            )}
          </>
        )}
        <h5 className="mt-3">{t('validateUi.claimValidations')}</h5>
        <ul>
          <li>
            {t('validateUi.claims.access.ver')} <code>{accessPayload.ver || '—'}</code>
            <span className="ml-2" style={{ color: 'var(--yellow-500)' }}>
              <span className="pi pi-forward mr-2" aria-label={t('validateUi.skippedAria')} />
              {t('validateUi.skipped')}
            </span>
          </li>
          <li>
            {t('validateUi.claims.access.aud')} <code>{String(accessPayload.aud)}</code> {isGraphAccessToken ? t('validateUi.claims.access.msGraph') : ''}
            <span className="ml-2"><StatusIcon ok={accClaimOk.audOk} /></span>
          </li>
          <li>
            {t('validateUi.claims.access.iss')} <code>{accessPayload.iss || '—'}</code> {tenantId ? `(tenant ${tenantId})` : ''}
            <span className="ml-2"><StatusIcon ok={accClaimOk.issOk} /></span>
          </li>
          <li>
            {t('validateUi.claims.access.exp')} <code>{fmtEpoch(accessPayload.exp)}</code>
            <span className="ml-2"><StatusIcon ok={accClaimOk.expOk} /></span>
          </li>
          <li>
            {t('validateUi.claims.access.nbfIat')}: nbf <code>{fmtEpoch(accessPayload.nbf)}</code>, iat <code>{fmtEpoch(accessPayload.iat)}</code>
            <span className="ml-2"><StatusIcon ok={accClaimOk.nbfOk && accClaimOk.iatOk} /></span>
          </li>
          {!isClientCredentials && (
            <li>
              {t('validateUi.claims.access.scp')} <code>{accessPayload.scp || '—'}</code>
              <span className="ml-2" style={{ color: 'var(--yellow-500)' }}>
                <span className="pi pi-forward mr-2" aria-label={t('validateUi.skippedAria')} />
                {t('validateUi.skipped')}
              </span>
            </li>
          )}
          {isClientCredentials && (
            <>
              <li>
                {t('validateUi.claims.access.roles')} <code>{Array.isArray(accessPayload.roles) ? accessPayload.roles.join(' ') : (accessPayload.roles || '—')}</code>
                <span className="ml-2" style={{ color: 'var(--yellow-500)' }}>
                  <span className="pi pi-forward mr-2" aria-label={t('validateUi.skippedAria')} />
                  {t('validateUi.skipped')}
                </span>
              </li>
              <li>
                {t('validateUi.claims.access.wids')} <code>{Array.isArray(accessPayload.wids) ? accessPayload.wids.join(' ') : (accessPayload.wids || '—')}</code>
                <span className="ml-2" style={{ color: 'var(--yellow-500)' }}>
                  <span className="pi pi-forward mr-2" aria-label={t('validateUi.skippedAria')} />
                  {t('validateUi.skipped')}
                </span>
              </li>
            </>
          )}
        </ul>
        {/* Diagnostics UI removed */}
      </div>
    </section>
  );
}
