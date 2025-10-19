"use client";
import {useEffect, useMemo, useRef, useState} from 'react';
import {useTranslations} from 'next-intl';
import {Card} from 'primereact/card';
import {Steps} from 'primereact/steps';
import type {MenuItem} from 'primereact/menuitem';
import {InputText} from 'primereact/inputtext';
import {InputTextarea} from 'primereact/inputtextarea';
import {Button} from 'primereact/button';


export default function AuthorizationCodePublicClientPage() {
  const t = useTranslations('AuthorizationCode.PublicClient');
  // Helper to return literal strings even if they contain {tenant}
  const safeT = (key: string): string => {
    try {
      const anyT = t as any;
      if (typeof anyT.raw === 'function') {
        const raw = anyT.raw(key);
        if (typeof raw === 'string') return raw;
      }
    } catch {
      // ignore
    }
    try {
      // Provide a dummy value to satisfy interpolation if required
      return t(key as any, { tenant: '{tenant}' } as any);
    } catch {
      return '';
    }
  };
  // Wizard state
  const [currentStep, setCurrentStep] = useState(0); // 0..6
  const [maxCompletedStep, setMaxCompletedStep] = useState(0);
  // Settings state (UI only)
  const [tenantId, setTenantId] = useState('');
  const [clientId, setClientId] = useState('');
  const [redirectUri, setRedirectUri] = useState('');
  const [scopes, setScopes] = useState('openid profile offline_access');
  const [authEndpoint, setAuthEndpoint] = useState('https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize');
  const [tokenEndpoint, setTokenEndpoint] = useState('https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token');
  // PKCE uses S256 only (plain not supported here)

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
  // Overview step replaces the old collapsible panel

  // Fallback diagram in case i18n key is missing
  const fallbackFlowDiagram = `Client (Browser)
  |
  | 1) Generate code_verifier + code_challenge (S256)
  v
Authorize Endpoint ------------------------------>
  |   GET .../authorize?client_id=...&redirect_uri=...
  |        &response_type=code&scope=...&state=...
  |        &code_challenge=...&code_challenge_method=S256
  |
  | 2) User signs in and consents
  v
Redirect (Callback) <------------------------------
  |   http(s)://your-app/callback/auth-code?code=...&state=...
  |
  | 3) Exchange code for tokens with code_verifier
  v
Token Endpoint ----------------------------------->
  |   POST grant_type=authorization_code
  |        &client_id=...
  |        &code=...
  |        &redirect_uri=...
  |        &code_verifier=...
  |
  | 4) Receive tokens (access_token, id_token, ... )
  v
Protected API (e.g., Graph) --------------------->
  |   Authorization: Bearer <access_token>
  v
  Response`;

  // Resolved endpoints: substitute tenant when valid, otherwise keep {tenant}
  // (defined after validation helpers to avoid use-before-declare)

  // Small helper to render labels with a help icon + tooltip
  const LabelWithHelp = ({id, text, help}: {id?: string; text: string; help: string}) => (
    <label htmlFor={id} className="block mb-2">
      {text}
      <span className="pi pi-question-circle ml-2" title={help} aria-label={help} />
    </label>
  );

  // Initialize redirectUri from current origin so it works in dev and prod
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setRedirectUri(`${window.location.origin}/callback/auth-code`);
    }
  }, []);

  // Validation helpers (Settings step) — hoisted before use
  const isGuid = (s: string) => /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(s);
  const isValidHttpUrl = (s: string) => {
    try {
      const u = new URL(s);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  };
  const tenantIdValid = tenantId.trim().length > 0 && isGuid(tenantId);
  const clientIdValid = isGuid(clientId);
  const redirectUriValid = isValidHttpUrl(redirectUri);

  // Resolved endpoints: substitute tenant when valid, otherwise keep {tenant}
  const resolvedAuthEndpoint = useMemo(() => {
    const tenant = tenantIdValid ? tenantId.trim() : '{tenant}';
    return authEndpoint.replace('{tenant}', tenant);
  }, [authEndpoint, tenantId, tenantIdValid]);
  const resolvedTokenEndpoint = useMemo(() => {
    const tenant = tenantIdValid ? tenantId.trim() : '{tenant}';
    return tokenEndpoint.replace('{tenant}', tenant);
  }, [tokenEndpoint, tenantId, tenantIdValid]);

  // Build the authorize URL preview from inputs (no validation for now)
  const authUrlPreview = useMemo(() => {
    if (!clientId || !tenantIdValid) return '';
    const base = authEndpoint.replace('{tenant}', tenantId.trim());
    const url = new URL(base);
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('response_type', responseType);
    url.searchParams.set('redirect_uri', redirectUri);
    if (scopes.trim()) url.searchParams.set('scope', scopes.trim());
    if (stateParam) url.searchParams.set('state', stateParam);
    if (nonce) url.searchParams.set('nonce', nonce);
    if (codeChallenge) {
      url.searchParams.set('code_challenge', codeChallenge);
      url.searchParams.set('code_challenge_method', 'S256');
    }
    return url.toString();
  }, [authEndpoint, clientId, codeChallenge, nonce, redirectUri, responseType, scopes, stateParam, tenantId, tenantIdValid]);

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

  // (Validation helpers already hoisted above)

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
    const ch = await computeS256Challenge(v);
    setCodeChallenge(ch);
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
    if (!authCode || !clientId || !redirectUri || !codeVerifier || !tokenEndpoint || !tenantIdValid) return;
    setExchanging(true);
    setTokenResponseText('');
    setAccessToken('');
    setIdToken('');
    setDecodedAccessHeader('');
    setDecodedAccessPayload('');
    setDecodedIdHeader('');
    setDecodedIdPayload('');
    try {
      const url = tokenEndpoint.replace('{tenant}', tenantId.trim());
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

  // Wizard validation per step
  const validators: Array<() => boolean> = [
    () => true, // 0 Overview
    () => clientIdValid && redirectUriValid && tenantIdValid, // 1 Settings
    () => !!codeVerifier && !!codeChallenge, // 2 PKCE
    () => !!authUrlPreview, // 3 Authorize URL
    () => !!authCode, // 4 Callback has code
    () => !!accessToken, // 5 Token exchange
    () => true, // 6 Decode
    () => false // 7 Call API (final)
  ];

  const canPrev = currentStep > 0;
  const canNext = currentStep < 7 && validators[currentStep]();

  const goPrev = () => {
    if (!canPrev) return;
    setCurrentStep((s) => Math.max(0, s - 1));
  };
  const goNext = () => {
    if (!canNext) return;
    setCurrentStep((s) => {
      const next = Math.min(7, s + 1);
      setMaxCompletedStep((m) => Math.max(m, next));
      return next;
    });
  };

  const stepLabels = [
    t('steps.overview'),
    t('steps.settings'),
    t('steps.pkce'),
    t('steps.authorize'),
    t('steps.callback'),
    t('steps.tokens'),
    t('steps.decode'),
    t('steps.callApi')
  ];
  const stepItems: MenuItem[] = stepLabels.map((label, idx) => ({
    label,
    disabled: idx > maxCompletedStep && idx > currentStep,
    command: () => {
      if (idx <= maxCompletedStep || idx <= currentStep) setCurrentStep(idx);
    }
  }));
  return (
    <div className="p-4">
  <Card title={t('title')}>
        {/* Steps header */}
        <div className="mb-4">
          <Steps model={stepItems} activeIndex={currentStep} readOnly={false} />
        </div>

        {/* Step content */}
        {currentStep === 0 && (
          <section>
            <h3 className="mt-0 mb-3">{t('sections.settings.flowPanelTitle')}</h3>
            <p className="mb-3">{t('sections.settings.flowIntro')}</p>
            {(() => {
              const keyPath = 'sections.settings.flowDiagram';
              let value: string | undefined;
              try {
                const anyT = t as any;
                value = typeof anyT.raw === 'function' ? anyT.raw(keyPath) : t(keyPath as any);
              } catch {
                value = undefined;
              }
              const expectedPath = `AuthorizationCode.PublicClient.${keyPath}`;
              const text = value && value !== expectedPath ? value : fallbackFlowDiagram;
              return <pre style={{whiteSpace: 'pre-wrap'}}>{text}</pre>;
            })()}
          </section>
        )}

        {currentStep === 1 && (
          <section>
            <h3 className="mt-0 mb-3">{t('sections.settings.title')}</h3>
            <p className="mb-3">{t('sections.settings.description')}</p>
            <div className="grid formgrid p-fluid">
              <div className="col-12 md:col-6">
                <LabelWithHelp id="tenantId" text={t('labels.tenantId')} help={t('help.tenantId')} />
                <InputText id="tenantId" value={tenantId} onChange={(e) => setTenantId(e.target.value)} placeholder={t('placeholders.tenantId')} className={!tenantIdValid ? 'p-invalid' : ''} />
                {!tenantIdValid && (
                  <small className="p-error block mt-1">{t('errors.tenantIdInvalid')}</small>
                )}
              </div>
              <div className="col-12 md:col-6">
                <LabelWithHelp id="clientId" text={t('labels.clientId')} help={t('help.clientId')} />
                <InputText id="clientId" value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder={t('placeholders.clientId')} className={!clientIdValid ? 'p-invalid' : ''} />
                {!clientIdValid && (
                  <small className="p-error block mt-1">{clientId ? t('errors.clientIdInvalid') : t('errors.clientIdRequired')}</small>
                )}
              </div>
              <div className="col-12 md:col-6">
                <LabelWithHelp id="redirectUri" text={t('labels.redirectUri')} help={t('help.redirectUri')} />
                <InputText id="redirectUri" value={redirectUri} readOnly placeholder={t('placeholders.redirectUri')} className={!redirectUriValid ? 'p-invalid' : ''} />
                {!redirectUriValid && (
                  <small className="p-error block mt-1">{t('errors.redirectUriInvalid')}</small>
                )}
              </div>
              <div className="col-12 md:col-6">
                <LabelWithHelp id="scopes" text={t('labels.scopes')} help={t('help.scopes')} />
                <InputText id="scopes" value={scopes} onChange={(e) => setScopes(e.target.value)} placeholder={t('placeholders.scopes')} />
              </div>
              <div className="col-12 md:col-6">
                <LabelWithHelp id="authEndpoint" text={t('labels.authEndpoint')} help={safeT('help.authEndpoint')} />
                <InputText id="authEndpoint" value={resolvedAuthEndpoint} readOnly placeholder={safeT('placeholders.authEndpoint')} />
              </div>
              <div className="col-12 md:col-6">
                <LabelWithHelp id="tokenEndpoint" text={t('labels.tokenEndpoint')} help={safeT('help.tokenEndpoint')} />
                <InputText id="tokenEndpoint" value={resolvedTokenEndpoint} readOnly placeholder={safeT('placeholders.tokenEndpoint')} />
              </div>
              {/* PKCE method is fixed to S256 (no dropdown) */}
            </div>
          </section>
        )}

        {currentStep === 2 && (
          <section>
            <h3 className="mt-0 mb-3">{t('sections.pkce.title')}</h3>
            <p className="mb-3">{t('sections.pkce.description')}</p>
            <div className="grid formgrid p-fluid">
              <div className="col-12 md:col-8">
                <LabelWithHelp id="codeVerifier" text={t('labels.codeVerifier')} help={t('help.codeVerifier')} />
                <InputText id="codeVerifier" value={codeVerifier} onChange={(e) => setCodeVerifier(e.target.value)} placeholder={t('placeholders.codeVerifier')} />
              </div>
              <div className="col-12 md:col-4 flex align-items-end">
                <Button type="button" label={t('buttons.generate')} icon="pi pi-refresh" className="w-full md:w-auto" onClick={handleGeneratePkce} />
              </div>
              <div className="col-12 md:col-8">
                <LabelWithHelp id="codeChallenge" text={t('labels.codeChallenge')} help={t('help.codeChallenge')} />
                <InputText id="codeChallenge" value={codeChallenge} onChange={(e) => setCodeChallenge(e.target.value)} placeholder={t('placeholders.codeChallenge')} readOnly />
              </div>
            </div>
          </section>
        )}

        {currentStep === 3 && (
          <section>
            <h3 className="mt-0 mb-3">{t('sections.authorize.title')}</h3>
            <p className="mb-3">{t('sections.authorize.description')}</p>
            <div className="grid formgrid p-fluid">
              <div className="col-12 md:col-6">
                <LabelWithHelp id="responseType" text={t('labels.responseType')} help={t('help.responseType')} />
                <InputText id="responseType" value={responseType} readOnly />
              </div>
              <div className="col-12 md:col-6">
                <LabelWithHelp id="state" text={t('labels.state')} help={t('help.state')} />
                <InputText id="state" value={stateParam} onChange={(e) => setStateParam(e.target.value)} placeholder={t('placeholders.state')} />
              </div>
              <div className="col-12 md:col-6">
                <LabelWithHelp id="nonce" text={t('labels.nonce')} help={t('help.nonce')} />
                <InputText id="nonce" value={nonce} onChange={(e) => setNonce(e.target.value)} placeholder={t('placeholders.nonce')} />
              </div>
              <div className="col-12">
                <LabelWithHelp id="authUrlPreview" text={t('labels.authUrlPreview')} help={t('help.authUrlPreview')} />
                <InputTextarea id="authUrlPreview" rows={3} autoResize value={authUrlPreview} placeholder={t('placeholders.authUrlPreview')} />
              </div>
              <div className="col-12 flex gap-2">
                <Button type="button" label={t('buttons.openPopup')} icon="pi pi-external-link" onClick={openAuthorizePopup} disabled={!authUrlPreview} />
                <Button type="button" label={t('buttons.copyUrl')} icon="pi pi-copy" disabled />
              </div>
            </div>
          </section>
        )}

        {currentStep === 4 && (
          <section>
            <h3 className="mt-0 mb-3">{t('sections.callback.title')}</h3>
            <p className="mb-3">{t('sections.callback.description')}</p>
            <div className="grid formgrid p-fluid">
              <div className="col-12">
                <LabelWithHelp id="callbackUrl" text={t('labels.callbackUrl')} help={t('help.callbackUrl')} />
                <InputTextarea id="callbackUrl" rows={3} autoResize value={callbackUrl} placeholder={t('placeholders.callbackUrl')} />
              </div>
              <div className="col-12 md:col-6">
                <LabelWithHelp id="authCode" text={t('labels.extractedCode')} help={t('help.extractedCode')} />
                <InputText id="authCode" value={authCode} placeholder={t('placeholders.extractedCode')} readOnly />
              </div>
              <div className="col-12 md:col-6">
                <LabelWithHelp id="extractedState" text={t('labels.extractedState')} help={t('help.extractedState')} />
                <InputText id="extractedState" value={extractedState} placeholder={t('placeholders.extractedState')} readOnly />
              </div>
            </div>
          </section>
        )}

        {currentStep === 5 && (
          <section>
            <h3 className="mt-0 mb-3">{t('sections.tokens.title')}</h3>
            <p className="mb-3">{t('sections.tokens.description')}</p>
            <div className="grid formgrid p-fluid">
              <div className="col-12">
                <LabelWithHelp id="tokenRequestBody" text={t('labels.tokenRequest')} help={t('help.tokenRequest')} />
                <InputTextarea id="tokenRequestBody" rows={4} autoResize value={tokenRequestPreview} placeholder={t('placeholders.tokenRequest')} />
              </div>
              <div className="col-12 flex gap-2">
                <Button type="button" label={exchanging ? t('buttons.sending') : t('buttons.send')} icon="pi pi-send" onClick={handleExchangeTokens} disabled={exchanging || !tokenRequestPreview} />
                <Button type="button" label={t('buttons.copyRequest')} icon="pi pi-copy" disabled />
              </div>
              <div className="col-12">
                <LabelWithHelp id="tokenResponse" text={t('labels.responsePreview')} help={t('help.responsePreview')} />
                <InputTextarea id="tokenResponse" rows={8} autoResize value={tokenResponseText} placeholder={t('placeholders.tokenResponse')} />
              </div>
            </div>
          </section>
        )}

        {currentStep === 6 && (
          <section>
            <h3 className="mt-0 mb-3">{t('sections.decode.title')}</h3>
            <p className="mb-3">{t('sections.decode.description')}</p>
            <div className="grid formgrid p-fluid">
              <div className="col-12">
                <LabelWithHelp id="accessToken" text={t('labels.accessToken')} help={t('help.accessToken')} />
                <InputTextarea id="accessToken" rows={3} autoResize value={accessToken} placeholder={t('placeholders.accessToken')} readOnly />
              </div>
              <div className="col-12">
                <LabelWithHelp id="idToken" text={t('labels.idToken')} help={t('help.idToken')} />
                <InputTextarea id="idToken" rows={3} autoResize value={idToken} placeholder={t('placeholders.idToken')} readOnly />
              </div>
              <div className="col-12 flex gap-2">
                <Button type="button" label={t('buttons.decode')} icon="pi pi-code" onClick={handleDecodeTokens} disabled={!accessToken && !idToken} />
              </div>
              <div className="col-12 md:col-6">
                <LabelWithHelp id="accessHeader" text={t('labels.accessHeader')} help={t('help.accessHeader')} />
                <InputTextarea id="accessHeader" rows={6} autoResize value={decodedAccessHeader} placeholder={t('placeholders.accessHeader')} />
              </div>
              <div className="col-12 md:col-6">
                <LabelWithHelp id="accessPayload" text={t('labels.accessPayload')} help={t('help.accessPayload')} />
                <InputTextarea id="accessPayload" rows={6} autoResize value={decodedAccessPayload} placeholder={t('placeholders.accessPayload')} />
              </div>
              <div className="col-12 md:col-6">
                <LabelWithHelp id="idHeader" text={t('labels.idHeader')} help={t('help.idHeader')} />
                <InputTextarea id="idHeader" rows={6} autoResize value={decodedIdHeader} placeholder={t('placeholders.idHeader')} />
              </div>
              <div className="col-12 md:col-6">
                <LabelWithHelp id="idPayload" text={t('labels.idPayload')} help={t('help.idPayload')} />
                <InputTextarea id="idPayload" rows={6} autoResize value={decodedIdPayload} placeholder={t('placeholders.idPayload')} />
              </div>
            </div>
          </section>
        )}

        {currentStep === 7 && (
          <section>
            <h3 className="mt-0 mb-3">{t('sections.callApi.title')}</h3>
            <p className="mb-3">{t('sections.callApi.description')}</p>
            <div className="grid formgrid p-fluid">
              <div className="col-12 md:col-8">
                <LabelWithHelp id="apiEndpoint" text={t('labels.apiEndpoint')} help={t('help.apiEndpoint')} />
                <InputText id="apiEndpoint" value={apiEndpointUrl} onChange={(e) => setApiEndpointUrl(e.target.value)} placeholder={t('placeholders.apiEndpoint')} />
              </div>
              <div className="col-12 md:col-4 flex align-items-end">
                <Button type="button" label={callingApi ? t('buttons.sending') : t('buttons.sendGet')} icon="pi pi-send" className="w-full md:w-auto" onClick={handleCallProtectedApi} disabled={callingApi || !apiEndpointUrl || !accessToken} />
              </div>
              <div className="col-12">
                <LabelWithHelp id="apiHeaders" text={t('labels.apiHeaders')} help={t('help.apiHeaders')} />
                <InputTextarea id="apiHeaders" rows={3} autoResize value={accessToken ? `Authorization: Bearer ${accessToken}` : ''} placeholder={t('placeholders.apiHeaders')} />
              </div>
              <div className="col-12">
                <LabelWithHelp id="apiResponse" text={t('labels.apiResponse')} help={t('help.apiResponse')} />
                <InputTextarea id="apiResponse" rows={8} autoResize value={apiResponseText} placeholder={t('placeholders.apiResponse')} />
              </div>
            </div>
          </section>
        )}

        {/* Wizard navigation */}
        <div className="flex justify-content-between align-items-center mt-4">
          <Button type="button" label={t('buttons.previous')} icon="pi pi-arrow-left" onClick={goPrev} disabled={!canPrev} className="p-button-secondary" />
          <Button type="button" label={t('buttons.next')} iconPos="right" icon="pi pi-arrow-right" onClick={goNext} disabled={!canNext} />
        </div>
      </Card>
    </div>
  );
}
