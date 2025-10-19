"use client";
import {useEffect, useMemo, useRef, useState} from 'react';
import {useTranslations} from 'next-intl';
import {Card} from 'primereact/card';
import {Panel} from 'primereact/panel';
import {Accordion, AccordionTab} from 'primereact/accordion';
import {InputText} from 'primereact/inputtext';
import {InputTextarea} from 'primereact/inputtextarea';
import {Dropdown} from 'primereact/dropdown';
import {Button} from 'primereact/button';
import {Divider} from 'primereact/divider';

type PkceMethod = 'S256' | 'plain';

export default function AuthorizationCodePublicClientPage() {
  const t = useTranslations('AuthorizationCode');
  // Settings state (UI only)
  const [tenantId, setTenantId] = useState('');
  const [clientId, setClientId] = useState('');
  const [redirectUri, setRedirectUri] = useState('http://localhost:3000/callback/auth-code');
  const [scopes, setScopes] = useState('openid profile offline_access');
  const [authEndpoint, setAuthEndpoint] = useState('https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize');
  const [tokenEndpoint, setTokenEndpoint] = useState('https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token');
  const [pkceMethod, setPkceMethod] = useState<PkceMethod>('S256');

  // Step 1: PKCE fields (UI only, no generation wired yet)
  const [codeVerifier, setCodeVerifier] = useState('');
  const [codeChallenge, setCodeChallenge] = useState('');

  // Step 2: Additional params
  const [responseType] = useState('code');
  const [stateParam, setStateParam] = useState('');
  const [nonce, setNonce] = useState('');

  // Step 3: Callback handling
  const [callbackUrl, setCallbackUrl] = useState('');
  const [authCode, setAuthCode] = useState('');
  const [extractedState, setExtractedState] = useState('');

  // Step 4: Token exchange
  const [exchanging, setExchanging] = useState(false);
  const [tokenResponseText, setTokenResponseText] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [idToken, setIdToken] = useState('');

  // Step 5: Decode tokens (JWT)
  const [decodedAccessHeader, setDecodedAccessHeader] = useState('');
  const [decodedAccessPayload, setDecodedAccessPayload] = useState('');
  const [decodedIdHeader, setDecodedIdHeader] = useState('');
  const [decodedIdPayload, setDecodedIdPayload] = useState('');

  // Step 5: Call protected API
  const [apiEndpointUrl, setApiEndpointUrl] = useState('https://graph.microsoft.com/v1.0/me');
  const [apiResponseText, setApiResponseText] = useState('');
  const [callingApi, setCallingApi] = useState(false);

  // Popup window ref
  const popupRef = useRef<Window | null>(null);

  // Build the authorize URL preview from inputs (no validation for now)
  const authUrlPreview = useMemo(() => {
    if (!clientId) return '';
    const tenant = tenantId || 'common';
    const base = authEndpoint.replace('{tenant}', tenant);
    const url = new URL(base);
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('response_type', responseType);
    url.searchParams.set('redirect_uri', redirectUri);
    if (scopes.trim()) url.searchParams.set('scope', scopes.trim());
    if (stateParam) url.searchParams.set('state', stateParam);
    if (nonce) url.searchParams.set('nonce', nonce);
    if (codeChallenge) {
      url.searchParams.set('code_challenge', codeChallenge);
      url.searchParams.set('code_challenge_method', pkceMethod);
    }
    return url.toString();
  }, [authEndpoint, clientId, codeChallenge, nonce, pkceMethod, redirectUri, responseType, scopes, stateParam, tenantId]);

  // Listen for postMessage from callback window
  useEffect(() => {
    const onMessage = (ev: MessageEvent) => {
      const data = ev.data as any;
      // Basic origin check: only accept messages from same origin
      if (typeof window !== 'undefined' && ev.origin !== window.location.origin) return;
      if (!data || data.type !== 'oauth_callback' || typeof data.href !== 'string') return;
      try {
        const u = new URL(data.href);
        setCallbackUrl(u.toString());
        const code = u.searchParams.get('code') || '';
        const st = u.searchParams.get('state') || '';
        setAuthCode(code);
        setExtractedState(st);
      } catch {
        // ignore parse errors
      }
      try {
        if (popupRef.current && !popupRef.current.closed) popupRef.current.close();
      } catch {
        // ignore
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const openAuthorizePopup = () => {
    if (!authUrlPreview) return;
    const w = 480;
    const h = 700;
    const left = window.screenX + (window.outerWidth - w) / 2;
    const top = window.screenY + (window.outerHeight - h) / 2;
    popupRef.current = window.open(
      authUrlPreview,
      'oauth_auth_popup',
      `width=${w},height=${h},left=${left},top=${top}`
    );
    popupRef.current?.focus();
  };

  // Helpers: PKCE generation
  const base64UrlEncode = (input: ArrayBuffer) => {
    const bytes = new Uint8Array(input);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    const b64 = typeof window !== 'undefined' ? window.btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  };

  const randomCodeVerifier = (length = 96) => {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    const random = new Uint8Array(length);
    crypto.getRandomValues(random);
    let result = '';
    for (let i = 0; i < length; i++) result += charset[random[i] % charset.length];
    return result;
  };

  const computeS256Challenge = async (verifier: string) => {
    const enc = new TextEncoder();
    const data = enc.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return base64UrlEncode(digest);
  };

  const handleGeneratePkce = async () => {
    const v = randomCodeVerifier();
    setCodeVerifier(v);
    if (pkceMethod === 'S256') {
      const ch = await computeS256Challenge(v);
      setCodeChallenge(ch);
    } else {
      setCodeChallenge(v);
    }
  };

  // Compute token request preview (x-www-form-urlencoded)
  const tokenRequestPreview = useMemo(() => {
    if (!clientId || !authCode || !redirectUri || !codeVerifier) return '';
    const params = new URLSearchParams();
    params.set('grant_type', 'authorization_code');
    params.set('client_id', clientId);
    params.set('code', authCode);
    params.set('redirect_uri', redirectUri);
    params.set('code_verifier', codeVerifier);
    if (scopes.trim()) params.set('scope', scopes.trim());
    return params.toString();
  }, [authCode, clientId, codeVerifier, redirectUri, scopes]);

  const handleExchangeTokens = async () => {
    if (!authCode || !clientId || !redirectUri || !codeVerifier || !tokenEndpoint) return;
    setExchanging(true);
    setTokenResponseText('');
    setAccessToken('');
    setIdToken('');
    setDecodedAccessHeader('');
    setDecodedAccessPayload('');
    setDecodedIdHeader('');
    setDecodedIdPayload('');
    try {
      const tenant = tenantId || 'common';
      const url = tokenEndpoint.replace('{tenant}', tenant);
      const body = new URLSearchParams();
      body.set('grant_type', 'authorization_code');
      body.set('client_id', clientId);
      body.set('code', authCode);
      body.set('redirect_uri', redirectUri);
      body.set('code_verifier', codeVerifier);
      if (scopes.trim()) body.set('scope', scopes.trim());

      const res = await fetch(url, {
        method: 'POST',
        headers: {'content-type': 'application/x-www-form-urlencoded'},
        body: body.toString()
      });
      const contentType = res.headers.get('content-type') || '';
      const txt = contentType.includes('application/json') ? JSON.stringify(await res.json(), null, 2) : await res.text();
      setTokenResponseText(txt);
      try {
        const parsed = JSON.parse(txt);
        if (parsed && typeof parsed === 'object' && parsed.access_token) {
          setAccessToken(parsed.access_token as string);
        }
        if (parsed && typeof parsed === 'object' && parsed.id_token) {
          setIdToken(parsed.id_token as string);
        }
      } catch {
        // non-JSON response
      }
    } catch (e: any) {
      setTokenResponseText(String(e));
    } finally {
      setExchanging(false);
    }
  };

  // Helpers to decode JWTs
  const base64UrlDecodeToString = (b64url: string) => {
    try {
      let b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
      const pad = b64.length % 4;
      if (pad === 2) b64 += '==';
      else if (pad === 3) b64 += '=';
      // pad === 1 is invalid, but let atob handle error
      const binary = typeof window !== 'undefined' ? window.atob(b64) : Buffer.from(b64, 'base64').toString('binary');
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return new TextDecoder().decode(bytes);
    } catch {
      return '';
    }
  };

  const decodeJwt = (token: string) => {
    try {
      const parts = token.split('.');
      if (parts.length < 2) return {header: '', payload: ''};
      const headerStr = base64UrlDecodeToString(parts[0]);
      const payloadStr = base64UrlDecodeToString(parts[1]);
      const pretty = (s: string) => {
        try {
          return JSON.stringify(JSON.parse(s), null, 2);
        } catch {
          return s || '';
        }
      };
      return {header: pretty(headerStr), payload: pretty(payloadStr)};
    } catch {
      return {header: '', payload: ''};
    }
  };

  const handleDecodeTokens = () => {
    const acc = accessToken ? decodeJwt(accessToken) : {header: '', payload: ''};
    const idt = idToken ? decodeJwt(idToken) : {header: '', payload: ''};
    setDecodedAccessHeader(acc.header);
    setDecodedAccessPayload(acc.payload);
    setDecodedIdHeader(idt.header);
    setDecodedIdPayload(idt.payload);
  };

  const handleCallProtectedApi = async () => {
    if (!apiEndpointUrl || !accessToken) return;
    setCallingApi(true);
    setApiResponseText('');
    try {
      const res = await fetch(apiEndpointUrl, {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const contentType = res.headers.get('content-type') || '';
      const txt = contentType.includes('application/json') ? JSON.stringify(await res.json(), null, 2) : await res.text();
      setApiResponseText(txt);
    } catch (e: any) {
      setApiResponseText(String(e));
    } finally {
      setCallingApi(false);
    }
  };
  return (
    <div className="p-4">
      <Card title={t('publicClientTitle')}>
        {/* Common settings panel */}
        <Panel header="Common Settings" toggleable>
          <div className="grid formgrid p-fluid">
            <div className="col-12 md:col-6">
              <label htmlFor="tenantId" className="block mb-2">Entra Tenant ID</label>
              <InputText id="tenantId" value={tenantId} onChange={(e) => setTenantId(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
            </div>
            <div className="col-12 md:col-6">
              <label htmlFor="clientId" className="block mb-2">Client ID</label>
              <InputText id="clientId" value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="App Registration (Public Client) ID" />
            </div>
            <div className="col-12 md:col-6">
              <label htmlFor="redirectUri" className="block mb-2">Redirect URI</label>
              <InputText id="redirectUri" value={redirectUri} onChange={(e) => setRedirectUri(e.target.value)} placeholder="http://localhost:3000/callback/auth-code" />
            </div>
            <div className="col-12 md:col-6">
              <label htmlFor="scopes" className="block mb-2">Scopes (space-separated)</label>
              <InputText id="scopes" value={scopes} onChange={(e) => setScopes(e.target.value)} placeholder="openid profile offline_access api://.../scope.read" />
            </div>
            <div className="col-12 md:col-6">
              <label htmlFor="authEndpoint" className="block mb-2">Authorization Endpoint</label>
              <InputText id="authEndpoint" value={authEndpoint} onChange={(e) => setAuthEndpoint(e.target.value)} placeholder="https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize" />
            </div>
            <div className="col-12 md:col-6">
              <label htmlFor="tokenEndpoint" className="block mb-2">Token Endpoint</label>
              <InputText id="tokenEndpoint" value={tokenEndpoint} onChange={(e) => setTokenEndpoint(e.target.value)} placeholder="https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token" />
            </div>
            <div className="col-12 md:col-6">
              <label htmlFor="pkceMethod" className="block mb-2">Code Challenge Method</label>
              <Dropdown id="pkceMethod" value={pkceMethod} onChange={(e) => setPkceMethod(e.value)} placeholder="Select method" options={[{label: 'S256', value: 'S256'}, {label: 'plain', value: 'plain'}]} />
            </div>
          </div>
        </Panel>

        <Divider />

        {/* OAuth flow steps */}
        <Accordion multiple>
          <AccordionTab header="1. Generate PKCE (code_verifier & code_challenge)">
            <div className="grid formgrid p-fluid">
              <div className="col-12 md:col-8">
                <label htmlFor="codeVerifier" className="block mb-2">Code Verifier</label>
                <InputText id="codeVerifier" value={codeVerifier} onChange={(e) => setCodeVerifier(e.target.value)} placeholder="Random high-entropy string" />
              </div>
              <div className="col-12 md:col-4 flex align-items-end">
                <Button type="button" label="Generate" icon="pi pi-refresh" className="w-full md:w-auto" onClick={handleGeneratePkce} />
              </div>
              <div className="col-12 md:col-8">
                <label htmlFor="codeChallenge" className="block mb-2">Code Challenge</label>
                <InputText id="codeChallenge" value={codeChallenge} onChange={(e) => setCodeChallenge(e.target.value)} placeholder="Derived from code_verifier (S256/plain)" readOnly />
              </div>
            </div>
          </AccordionTab>

          <AccordionTab header="2. Build authorization request URL">
            <div className="grid formgrid p-fluid">
              <div className="col-12 md:col-6">
                <label htmlFor="responseType" className="block mb-2">response_type</label>
                <InputText id="responseType" value={responseType} readOnly />
              </div>
              <div className="col-12 md:col-6">
                <label htmlFor="state" className="block mb-2">state</label>
                <InputText id="state" value={stateParam} onChange={(e) => setStateParam(e.target.value)} placeholder="Optional state (recommended)" />
              </div>
              <div className="col-12 md:col-6">
                <label htmlFor="nonce" className="block mb-2">nonce</label>
                <InputText id="nonce" value={nonce} onChange={(e) => setNonce(e.target.value)} placeholder="Optional nonce" />
              </div>
              <div className="col-12">
                <label htmlFor="authUrlPreview" className="block mb-2">Authorization URL preview</label>
                <InputTextarea id="authUrlPreview" rows={3} autoResize value={authUrlPreview} placeholder="https://login.microsoftonline.com/.../authorize?..." />
              </div>
              <div className="col-12 flex gap-2">
                <Button type="button" label="Open popup" icon="pi pi-external-link" onClick={openAuthorizePopup} disabled={!authUrlPreview} />
                <Button type="button" label="Copy URL" icon="pi pi-copy" disabled />
              </div>
            </div>
          </AccordionTab>

          <AccordionTab header="3. Handle redirect (auto-pasted from popup)">
            <div className="grid formgrid p-fluid">
              <div className="col-12">
                <label htmlFor="callbackUrl" className="block mb-2">Callback URL</label>
                <InputTextarea id="callbackUrl" rows={3} autoResize value={callbackUrl} placeholder="http://localhost:3000/callback/auth-code?code=...&state=..." />
              </div>
              <div className="col-12 md:col-6">
                <label htmlFor="authCode" className="block mb-2">Extracted code</label>
                <InputText id="authCode" value={authCode} placeholder="exchange me for tokens" readOnly />
              </div>
              <div className="col-12 md:col-6">
                <label htmlFor="extractedState" className="block mb-2">Extracted state</label>
                <InputText id="extractedState" value={extractedState} placeholder="(if provided)" readOnly />
              </div>
            </div>
          </AccordionTab>

          <AccordionTab header="4. Exchange code for tokens">
            <div className="grid formgrid p-fluid">
              <div className="col-12">
                <label htmlFor="tokenRequestBody" className="block mb-2">Token request (x-www-form-urlencoded)</label>
                <InputTextarea id="tokenRequestBody" rows={4} autoResize value={tokenRequestPreview} placeholder="grant_type=authorization_code&client_id=...&code=...&redirect_uri=...&code_verifier=..." />
              </div>
              <div className="col-12 flex gap-2">
                <Button type="button" label={exchanging ? 'Sending…' : 'Send'} icon="pi pi-send" onClick={handleExchangeTokens} disabled={exchanging || !tokenRequestPreview} />
                <Button type="button" label="Copy request" icon="pi pi-copy" disabled />
              </div>
              <div className="col-12">
                <label htmlFor="tokenResponse" className="block mb-2">Response preview</label>
                <InputTextarea id="tokenResponse" rows={8} autoResize value={tokenResponseText} placeholder='{"access_token":"...","refresh_token":"...","id_token":"..."}' />
              </div>
            </div>
          </AccordionTab>

          <AccordionTab header="5. Decode tokens (JWT)">
            <div className="grid formgrid p-fluid">
              <div className="col-12">
                <label htmlFor="accessToken" className="block mb-2">Access token (JWT)</label>
                <InputTextarea id="accessToken" rows={3} autoResize value={accessToken} placeholder="eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...." readOnly />
              </div>
              <div className="col-12">
                <label htmlFor="idToken" className="block mb-2">ID token (JWT)</label>
                <InputTextarea id="idToken" rows={3} autoResize value={idToken} placeholder="eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...." readOnly />
              </div>
              <div className="col-12 flex gap-2">
                <Button type="button" label="Decode" icon="pi pi-code" onClick={handleDecodeTokens} disabled={!accessToken && !idToken} />
              </div>
              <div className="col-12 md:col-6">
                <label htmlFor="accessHeader" className="block mb-2">Access token header</label>
                <InputTextarea id="accessHeader" rows={6} autoResize value={decodedAccessHeader} placeholder='{"alg":"RS256","kid":"..."}' />
              </div>
              <div className="col-12 md:col-6">
                <label htmlFor="accessPayload" className="block mb-2">Access token payload</label>
                <InputTextarea id="accessPayload" rows={6} autoResize value={decodedAccessPayload} placeholder='{"aud":"...","scp":"...","exp":...}' />
              </div>
              <div className="col-12 md:col-6">
                <label htmlFor="idHeader" className="block mb-2">ID token header</label>
                <InputTextarea id="idHeader" rows={6} autoResize value={decodedIdHeader} placeholder='{"alg":"RS256","kid":"..."}' />
              </div>
              <div className="col-12 md:col-6">
                <label htmlFor="idPayload" className="block mb-2">ID token payload</label>
                <InputTextarea id="idPayload" rows={6} autoResize value={decodedIdPayload} placeholder='{"sub":"...","name":"...","email":"..."}' />
              </div>
            </div>
          </AccordionTab>

          <AccordionTab header="6. Call protected API">
            <div className="grid formgrid p-fluid">
              <div className="col-12 md:col-8">
                <label htmlFor="apiEndpoint" className="block mb-2">API endpoint</label>
                <InputText id="apiEndpoint" value={apiEndpointUrl} onChange={(e) => setApiEndpointUrl(e.target.value)} placeholder="https://graph.microsoft.com/v1.0/me" />
              </div>
              <div className="col-12 md:col-4 flex align-items-end">
                <Button type="button" label={callingApi ? 'Sending…' : 'Send GET'} icon="pi pi-send" className="w-full md:w-auto" onClick={handleCallProtectedApi} disabled={callingApi || !apiEndpointUrl || !accessToken} />
              </div>
              <div className="col-12">
                <label htmlFor="apiHeaders" className="block mb-2">Request headers</label>
                <InputTextarea id="apiHeaders" rows={3} autoResize value={accessToken ? `Authorization: Bearer ${accessToken}` : ''} placeholder="Authorization: Bearer <access_token>" />
              </div>
              <div className="col-12">
                <label htmlFor="apiResponse" className="block mb-2">Response preview</label>
                <InputTextarea id="apiResponse" rows={8} autoResize value={apiResponseText} placeholder='{"displayName":"..."}' />
              </div>
            </div>
          </AccordionTab>
        </Accordion>
      </Card>
    </div>
  );
}
