"use client";
import {useEffect, useMemo, useRef, useState} from 'react';
import {useTranslations} from 'next-intl';
import {Card} from 'primereact/card';
import {Steps} from 'primereact/steps';
import type {MenuItem} from 'primereact/menuitem';
import {Button} from 'primereact/button';
import StepOverview from './components/StepOverview';
import StepSettings from './components/StepSettings';
import StepPkce from './components/StepPkce';
import StepAuthorize from './components/StepAuthorize';
import StepCallback from './components/StepCallback';
import StepTokens from './components/StepTokens';
import StepDecode from './components/StepDecode';
import StepCallApi from './components/StepCallApi';
import StepValidate from './components/StepValidate';
import LabelWithHelp from '@/components/LabelWithHelp';
import { base64UrlEncode, randomCodeVerifier, computeS256Challenge } from '@/lib/pkce';
import { base64UrlDecodeToString, decodeJwt } from '@/lib/jwt';


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
  const [currentStep, setCurrentStep] = useState(0); // 0..8 (with Validate)
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
  const [responseMode, setResponseMode] = useState('');
  const [prompt, setPrompt] = useState('');
  const [loginHint, setLoginHint] = useState('');

  // Step 3: Callback handling
  const [callbackUrl, setCallbackUrl] = useState('');
  const [authCode, setAuthCode] = useState('');
  const [extractedState, setExtractedState] = useState('');
  const [callbackValidated, setCallbackValidated] = useState(false);

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

  // Step 6: Validate tokens (claims & signature guidance)
  // no extra state

  // Step 7: Call protected API
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

  // Small helper moved to shared component (imported as LabelWithHelp)

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
    if (responseMode) url.searchParams.set('response_mode', responseMode);
    if (prompt) url.searchParams.set('prompt', prompt);
    if (loginHint) url.searchParams.set('login_hint', loginHint);
  // domain_hint and claims intentionally omitted here per request
    if (codeChallenge) {
      url.searchParams.set('code_challenge', codeChallenge);
      url.searchParams.set('code_challenge_method', 'S256');
    }
    return url.toString();
  }, [authEndpoint, clientId, codeChallenge, nonce, redirectUri, responseMode, prompt, loginHint, responseType, scopes, stateParam, tenantId, tenantIdValid]);

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
        // Mark callback as validated if state matches (or no state was set)
        const ok = !!code && (!stateParam || stateParam === st);
        setCallbackValidated((prev) => prev || ok);
        // After receiving a code, automatically move to the Callback step
        setCurrentStep(4);
        setMaxCompletedStep((m) => Math.max(m, 4));
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

  // Generators for state/nonce
  const generateRandomString = (length = 32) => {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    const rnd = new Uint8Array(length);
    crypto.getRandomValues(rnd);
    let out = '';
    for (let i = 0; i < length; i++) out += charset[rnd[i] % charset.length];
    return out;
  };
  const handleGenerateState = () => setStateParam(generateRandomString(32));
  const handleGenerateNonce = () => setNonce(generateRandomString(32));

  // (Validation helpers already hoisted above)

  // Helpers: PKCE generation
  // PKCE helpers moved to '@/lib/pkce'

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
  // JWT helpers moved to '@/lib/jwt'

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
  () => callbackValidated || (!!authCode && (!stateParam || stateParam === extractedState)), // 3 Authorize: enabled after successful callback
  () => callbackValidated || maxCompletedStep >= 5 || (!!authCode && (!stateParam || stateParam === extractedState)), // 4 Callback validated or previously completed
    () => !!accessToken, // 5 Token exchange
    () => true, // 6 Decode
    () => true, // 7 Validate (informational)
    () => false // 8 Call API (final)
  ];

  const canPrev = currentStep > 0;
  const canNext = currentStep < 8 && validators[currentStep]();

  const goPrev = () => {
    if (!canPrev) return;
    setCurrentStep((s) => Math.max(0, s - 1));
  };
  const goNext = () => {
    if (!canNext) return;
    setCurrentStep((s) => {
      const next = Math.min(8, s + 1);
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
    t('steps.validate'),
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
          <StepOverview fallbackFlowDiagram={fallbackFlowDiagram} />
        )}

        {currentStep === 1 && (
          <StepSettings
            tenantId={tenantId}
            setTenantId={setTenantId}
            clientId={clientId}
            setClientId={setClientId}
            redirectUri={redirectUri}
            scopes={scopes}
            setScopes={setScopes}
            resolvedAuthEndpoint={resolvedAuthEndpoint}
            resolvedTokenEndpoint={resolvedTokenEndpoint}
            tenantIdValid={tenantIdValid}
            clientIdValid={clientIdValid}
            redirectUriValid={redirectUriValid}
            safeT={safeT}
          />
        )}

        {currentStep === 2 && (
          <StepPkce
            codeVerifier={codeVerifier}
            setCodeVerifier={setCodeVerifier}
            codeChallenge={codeChallenge}
            onGeneratePkce={handleGeneratePkce}
          />
        )}

        {currentStep === 3 && (
          <StepAuthorize
            responseType={responseType}
            stateParam={stateParam}
            setStateParam={setStateParam}
            onGenerateState={handleGenerateState}
            nonce={nonce}
            setNonce={setNonce}
            onGenerateNonce={handleGenerateNonce}
            responseMode={responseMode}
            setResponseMode={setResponseMode}
            prompt={prompt}
            setPrompt={setPrompt}
            loginHint={loginHint}
            setLoginHint={setLoginHint}
            authUrlPreview={authUrlPreview}
            onOpenPopup={openAuthorizePopup}
          />
        )}

        {currentStep === 4 && (
          <StepCallback
            callbackUrl={callbackUrl}
            authCode={authCode}
            extractedState={extractedState}
            expectedState={stateParam}
          />
        )}

        {currentStep === 5 && (
          <StepTokens
            tokenRequestPreview={tokenRequestPreview}
            tokenResponseText={tokenResponseText}
            exchanging={exchanging}
            onExchangeTokens={handleExchangeTokens}
          />
        )}

        {currentStep === 6 && (
          <StepDecode
            accessToken={accessToken}
            idToken={idToken}
            decodedAccessHeader={decodedAccessHeader}
            decodedAccessPayload={decodedAccessPayload}
            decodedIdHeader={decodedIdHeader}
            decodedIdPayload={decodedIdPayload}
            onDecodeTokens={handleDecodeTokens}
          />
        )}

        {currentStep === 7 && (
          <StepValidate
            tenantId={tenantId}
            clientId={clientId}
            expectedNonce={nonce}
            decodedAccessHeader={decodedAccessHeader}
            decodedAccessPayload={decodedAccessPayload}
            decodedIdHeader={decodedIdHeader}
            decodedIdPayload={decodedIdPayload}
            accessToken={accessToken}
            idToken={idToken}
          />
        )}

        {currentStep === 8 && (
          <StepCallApi
            apiEndpointUrl={apiEndpointUrl}
            setApiEndpointUrl={setApiEndpointUrl}
            accessToken={accessToken}
            apiResponseText={apiResponseText}
            callingApi={callingApi}
            onCallApi={handleCallProtectedApi}
          />
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
