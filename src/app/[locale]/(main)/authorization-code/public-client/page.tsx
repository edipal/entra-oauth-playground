"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Steps } from 'primereact/steps';
import type { MenuItem } from 'primereact/menuitem';
import { Button } from 'primereact/button';
import StepOverview from '@/components/steps/StepOverview';
import StepSettings from '@/components/steps/StepSettings';
import StepPkce from '@/components/steps/StepPkce';
import StepAuthorize from '@/components/steps/StepAuthorize';
import StepCallback from '@/components/steps/StepCallback';
import StepTokens from '@/components/steps/StepTokens';
import StepDecode from '@/components/steps/StepDecode';
import StepCallApi from '@/components/steps/StepCallApi';
import StepValidate from '@/components/steps/StepValidate';
import { randomCodeVerifier, computeS256Challenge } from '@/lib/pkce';
import { randomUrlSafeString } from '@/lib/random';
import { decodeJwt } from '@/lib/jwtDecode';
import { TranslationUtils } from '@/lib/translation';
import { useSettings } from '@/components/SettingsContext';


enum StepIndex {
  Overview = 0,
  Settings = 1,
  Pkce = 2,
  Authorize = 3,
  Callback = 4,
  Tokens = 5,
  Decode = 6,
  Validate = 7,
  CallApi = 8
}

export default function AuthorizationCodePublicClientPage() {
  const tMain = useTranslations('AuthorizationCode.PublicClient.Main');
  const tStepSettings = useTranslations('StepSettings');

  // Helper to return literal strings for StepSettings even if they contain {tenant}
  const safeStepSettingsT = (key: string): string => TranslationUtils.safeT(tStepSettings, key);

  // Settings persisted/global via SettingsContext
  const { authCodePublicClientConfig, setAuthCodePublicClientConfig, authCodePublicClientRuntime, setAuthCodePublicClientRuntime, resetAuthCodePublicClientRuntime, hydrated } = useSettings();
  const streamlined = !!authCodePublicClientConfig.streamlined;
  const pkceEnabled = !!authCodePublicClientConfig.pkceEnabled;

  // Wizard state (start at Settings by default; Overview still accessible via steps navigation)
  const [currentStep, setCurrentStep] = useState<StepIndex>(() => StepIndex.Settings);
  const [maxCompletedStep, setMaxCompletedStep] = useState<StepIndex>(StepIndex.Overview);
  const tenantId = authCodePublicClientConfig.tenantId!;
  const clientId = authCodePublicClientConfig.clientId!;
  const redirectUri = authCodePublicClientConfig.redirectUri!;
  const scopes = authCodePublicClientConfig.scopes!;
  const authEndpoint = authCodePublicClientRuntime.authEndpoint!;
  const tokenEndpoint = authCodePublicClientRuntime.tokenEndpoint!;

  // PKCE fields (global runtime via context)
  const codeVerifier = authCodePublicClientRuntime.codeVerifier!;
  const codeChallenge = authCodePublicClientRuntime.codeChallenge!;

  // Additional params
  const [responseType] = useState('code');
  const stateParam = authCodePublicClientRuntime.stateParam!;
  const nonce = authCodePublicClientRuntime.nonce!;
  const [responseMode, setResponseMode] = useState('');
  const [prompt, setPrompt] = useState('');
  const [loginHint, setLoginHint] = useState('');

  // Callback handling
  const callbackUrl = authCodePublicClientRuntime.callbackUrl!;
  const callbackBody = authCodePublicClientRuntime.callbackBody!;
  const authCode = authCodePublicClientRuntime.authCode!;
  const extractedState = authCodePublicClientRuntime.extractedState!;
  const callbackValidated = !!authCodePublicClientRuntime.callbackValidated;

  // Token exchange
  const [exchanging, setExchanging] = useState(false);
  const [tokenResponseText, setTokenResponseText] = useState('');
  const accessToken = authCodePublicClientRuntime.accessToken!;
  const idToken = authCodePublicClientRuntime.idToken!;

  // Decode tokens (JWT)
  const [decodedAccessHeader, setDecodedAccessHeader] = useState('');
  const [decodedAccessPayload, setDecodedAccessPayload] = useState('');
  const [decodedIdHeader, setDecodedIdHeader] = useState('');
  const [decodedIdPayload, setDecodedIdPayload] = useState('');

  // Call protected API
  const apiEndpointUrl = authCodePublicClientConfig.apiEndpointUrl!;
  const [apiResponseText, setApiResponseText] = useState('');
  const [callingApi, setCallingApi] = useState(false);

  // Popup window ref
  const popupRef = useRef<Window | null>(null);
  // Scroll-to-top anchor
  const topRef = useRef<HTMLDivElement | null>(null);

  // Initialize redirectUri from current origin so it works in dev and prod
  useEffect(() => {
    if (typeof window !== 'undefined' && hydrated) {
      const uri = `${window.location.origin}/callback/auth-code`;
      if (!redirectUri) {
        setAuthCodePublicClientConfig(prev => ({ ...prev, redirectUri: uri }));
      }
    }
  }, [redirectUri, setAuthCodePublicClientConfig, hydrated]);

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
    if (pkceEnabled && codeChallenge) {
      url.searchParams.set('code_challenge', codeChallenge);
      url.searchParams.set('code_challenge_method', 'S256');
    }
    return url.toString();
  }, [authEndpoint, clientId, codeChallenge, nonce, redirectUri, responseMode, prompt, loginHint, responseType, scopes, stateParam, tenantId, tenantIdValid, pkceEnabled]);

  // Listen for postMessage from callback window
  useEffect(() => {
    const onMessage = (ev: MessageEvent) => {
      const data = ev.data as any;
      // Basic origin check: only accept messages from same origin
      if (typeof window !== 'undefined' && ev.origin !== window.location.origin) return;
      if (!data || data.type !== 'oauth_callback') return;
      try {
        const urlStr: string = typeof data.url === 'string' ? data.url : (typeof data.href === 'string' ? data.href : '');
        if (!urlStr) return;
        const bodyStr: string = typeof data.body === 'string' ? data.body : '';
        let code = '';
        let st = '';
        if (bodyStr) {
          const p = new URLSearchParams(bodyStr);
          code = p.get('code') || '';
          st = p.get('state') || '';
        } else {
          const u = new URL(urlStr);
          code = u.searchParams.get('code') || '';
          st = u.searchParams.get('state') || '';
        }
        // Mark callback as validated if state matches (or no state was set)
        const ok = !!code && (!stateParam || stateParam === st);
        setAuthCodePublicClientRuntime(prev => ({
          callbackUrl: urlStr,
          callbackBody: bodyStr,
          authCode: code,
          extractedState: st,
          callbackValidated: (prev.callbackValidated || ok)
        }));
        // After receiving a code
        if (streamlined && ok) {
          // In streamlined mode with valid callback, jump straight to Tokens
          setCurrentStep(5);
          setMaxCompletedStep((m) => Math.max(m, 5));
        } else {
          // Otherwise go to Callback step
          setCurrentStep(4);
          setMaxCompletedStep((m) => Math.max(m, 4));
        }
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
  }, [stateParam, setAuthCodePublicClientRuntime, streamlined]);

  // Streamlined: when on Tokens step, auto exchange tokens once inputs are ready
  const autoExchangedRef = useRef(false);
  const autoAdvancedFromTokensRef = useRef(false);
  useEffect(() => {
    if (!streamlined) return;
    if (currentStep !== StepIndex.Tokens) return;
    // If already have tokens, advance to Decode
    if (accessToken && !autoAdvancedFromTokensRef.current) {
      autoAdvancedFromTokensRef.current = true;
      setCurrentStep(StepIndex.Decode);
      setMaxCompletedStep((m) => (Math.max(m as number, StepIndex.Decode as number) as StepIndex));
      return;
    }
    if (autoExchangedRef.current) return;
    // Trigger exchange if we have enough data
    if (!exchanging && authCode && clientId && redirectUri && (!pkceEnabled || codeVerifier) && tokenEndpoint && tenantIdValid) {
      autoExchangedRef.current = true;
      void handleExchangeTokens();
    }
  }, [streamlined, currentStep, exchanging, authCode, clientId, redirectUri, codeVerifier, tokenEndpoint, tenantIdValid, accessToken, pkceEnabled]);

  // Streamlined: when on Decode step, auto decode then advance to Validate
  const autoDecodedRef = useRef(false);
  const autoAdvancedFromDecodeRef = useRef(false);
  useEffect(() => {
    if (!streamlined) return;
    if (currentStep !== StepIndex.Decode) return;
    if (!autoDecodedRef.current) {
      autoDecodedRef.current = true;
      handleDecodeTokens();
    }
    // After a brief tick, move to Validate if we have some decoded content or tokens
    const hasSomething = !!accessToken || !!idToken;
    if (hasSomething && !autoAdvancedFromDecodeRef.current) {
      autoAdvancedFromDecodeRef.current = true;
      const t = setTimeout(() => {
        setCurrentStep(StepIndex.Validate);
        setMaxCompletedStep((m) => (Math.max(m as number, StepIndex.Validate as number) as StepIndex));
      }, 50);
      return () => clearTimeout(t);
    }
  }, [streamlined, currentStep, accessToken, idToken]);

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

  // Generators for state/nonce centralised in random utilities
  const handleGenerateState = () => setAuthCodePublicClientRuntime({ stateParam: randomUrlSafeString(32) });
  const handleGenerateNonce = () => setAuthCodePublicClientRuntime({ nonce: randomUrlSafeString(32) });

  // (Validation helpers already hoisted above)

  // Helpers: PKCE generation
  const handleGeneratePkce = async () => {
    const v = randomCodeVerifier();
    const ch = await computeS256Challenge(v);
    setAuthCodePublicClientRuntime({ codeVerifier: v, codeChallenge: ch });
  };

  // Compute token request preview (x-www-form-urlencoded)
  const tokenRequestPreview = useMemo(() => {
    if (!clientId || !authCode || !redirectUri || (pkceEnabled && !codeVerifier)) return '';
    const params = new URLSearchParams();
    params.set('grant_type', 'authorization_code');
    params.set('client_id', clientId);
    params.set('code', authCode);
    params.set('redirect_uri', redirectUri);
    if (pkceEnabled) params.set('code_verifier', codeVerifier);
    if (scopes.trim()) params.set('scope', scopes.trim());
    return params.toString();
  }, [authCode, clientId, codeVerifier, redirectUri, scopes, pkceEnabled]);

  const handleExchangeTokens = async () => {
    if (!authCode || !clientId || !redirectUri || (pkceEnabled && !codeVerifier) || !tokenEndpoint || !tenantIdValid) return;
    setExchanging(true);
    setTokenResponseText('');
    setAuthCodePublicClientRuntime({ accessToken: '', idToken: '' });
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
      if (pkceEnabled) body.set('code_verifier', codeVerifier);
      if (scopes.trim()) body.set('scope', scopes.trim());

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      });
      const contentType = res.headers.get('content-type') || '';
      const txt = contentType.includes('application/json') ? JSON.stringify(await res.json(), null, 2) : await res.text();
      setTokenResponseText(txt);
      try {
        const parsed = JSON.parse(txt);
        if (parsed && typeof parsed === 'object' && parsed.access_token) {
          setAuthCodePublicClientRuntime({ accessToken: parsed.access_token as string });
        }
        if (parsed && typeof parsed === 'object' && parsed.id_token) {
          setAuthCodePublicClientRuntime({ idToken: parsed.id_token as string });
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
  const handleDecodeTokens = () => {
    const acc = accessToken ? decodeJwt(accessToken) : { header: '', payload: '' };
    const idt = idToken ? decodeJwt(idToken) : { header: '', payload: '' };
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

  // Start a new flow WITHOUT altering persisted settings in localStorage
  const handleResetFlow = () => {
    // Reset runtime (non-persisted)
    resetAuthCodePublicClientRuntime();
    // Reset local component state and wizard progression
    setCurrentStep(StepIndex.Settings);
    setMaxCompletedStep(StepIndex.Overview);
    setResponseMode('');
    setPrompt('');
    setLoginHint('');
    setTokenResponseText('');
    setDecodedAccessHeader('');
    setDecodedAccessPayload('');
    setDecodedIdHeader('');
    setDecodedIdPayload('');
    setApiResponseText('');
    try { if (popupRef.current && !popupRef.current.closed) popupRef.current.close(); } catch { }
    popupRef.current = null;
    // Reset streamlined automation flags
    try {
      autoExchangedRef.current = false;
      autoDecodedRef.current = false;
      (autoAdvancedFromTokensRef as any)?.current !== undefined && ((autoAdvancedFromTokensRef as any).current = false);
      (autoAdvancedFromDecodeRef as any)?.current !== undefined && ((autoAdvancedFromDecodeRef as any).current = false);
    } catch { }
  };

  // Start a new flow AND erase persisted settings for this flow (localStorage)
  const handleEraseAll = () => {
    // Reset persisted config to defaults (this writes to localStorage)
    setAuthCodePublicClientConfig({
      tenantId: '',
      clientId: '',
      redirectUri: '',
      scopes: 'openid profile offline_access',
      apiEndpointUrl: 'https://graph.microsoft.com/v1.0/me',
      streamlined: false,
      pkceEnabled: true
    });
    // Then do a normal flow reset
    handleResetFlow();
  };

  // Wizard validation per step
  // validators indexed by StepIndex
  const validators: Record<StepIndex, () => boolean> = {
    [StepIndex.Overview]: () => true,
    [StepIndex.Settings]: () => clientIdValid && redirectUriValid && tenantIdValid,
    [StepIndex.Pkce]: () => pkceEnabled ? (!!codeVerifier && !!codeChallenge) : true,
    [StepIndex.Authorize]: () => callbackValidated || (!!authCode && (!stateParam || stateParam === extractedState)),
    [StepIndex.Callback]: () => callbackValidated || maxCompletedStep >= StepIndex.Tokens || (!!authCode && (!stateParam || stateParam === extractedState)),
    [StepIndex.Tokens]: () => !!accessToken,
    [StepIndex.Decode]: () => true,
    [StepIndex.Validate]: () => true,
    [StepIndex.CallApi]: () => false
  };

  const canPrev = currentStep > StepIndex.Overview;
  const canNext = currentStep < StepIndex.CallApi && validators[currentStep]?.();

  const goPrev = () => {
    if (!canPrev) return;
    setCurrentStep((s) => (Math.max(StepIndex.Overview, (s as number) - 1) as StepIndex));
  };
  const goNext = () => {
    if (!canNext) return;
    // Special streamlined behavior: from Settings, auto-generate PKCE and skip the PKCE UI
    if (streamlined && currentStep === StepIndex.Settings) {
      // Generate PKCE (async) and jump to Authorize
      if (pkceEnabled) void handleGeneratePkce();
      setCurrentStep(StepIndex.Authorize);
      setMaxCompletedStep((m) => (Math.max(m as number, StepIndex.Authorize as number) as StepIndex));
      return;
    }
    setCurrentStep((s) => {
      const next = Math.min(StepIndex.CallApi, (s as number) + 1) as StepIndex;
      setMaxCompletedStep((m) => (Math.max(m as number, next as number) as StepIndex));
      return next;
    });
  };

  const stepLabels = [
    tMain('steps.overview'),
    tMain('steps.settings'),
    tMain('steps.pkce'),
    tMain('steps.authorize'),
    tMain('steps.callback'),
    tMain('steps.tokens'),
    tMain('steps.decode'),
    tMain('steps.validate'),
    tMain('steps.callApi')
  ];
  const stepItems: MenuItem[] = stepLabels.map((label, idx) => ({
    label,
    disabled: idx > (maxCompletedStep as number) && idx > (currentStep as number),
    command: () => {
      if (idx <= (maxCompletedStep as number) || idx <= (currentStep as number)) setCurrentStep(idx as StepIndex);
    }
  }));
  // When step changes, scroll to top of the scrollable container
  useEffect(() => {
    try {
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Fallback for environments where scrollIntoView doesn't affect the intended container
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch { }
  }, [currentStep]);
  return (
    <>
      <div ref={topRef} />

      <div className="flex w-full align-items-center justify-content-between mt-40">
        <h4>{tMain('title')}</h4>
        <div className="flex align-items-center gap-2">
          <Button
            type="button"
            className="shadow-2"
            icon="pi pi-undo"
            onClick={handleResetFlow}
            aria-label={tMain('header.resetAria')}
            title={tMain('header.resetTitle')}
            style={{ transform: 'scale(0.75)', transformOrigin: 'center' }}
          />
          <Button
            type="button"
            className="shadow-2"
            icon="pi pi-eraser"
            severity="danger"
            onClick={handleEraseAll}
            aria-label={tMain('header.eraseAria')}
            title={tMain('header.eraseTitle')}
            style={{ transform: 'scale(0.75)', transformOrigin: 'center' }}
          />
        </div>
      </div>

      {/* Steps header */}
      <div className="step-header mt-5 mb-5">
        <Steps model={stepItems} activeIndex={currentStep} readOnly={false} />
      </div>

      {/* Step content */}
      {currentStep === StepIndex.Overview && (
        <StepOverview
          flowIntro={tMain('overview.flowIntro')}
          flowDiagram={tMain('overview.flowDiagram')}
        />
      )}

      {currentStep === StepIndex.Settings && (
        <StepSettings
          tenantId={tenantId}
          setTenantId={(v) => setAuthCodePublicClientConfig({ tenantId: v })}
          clientId={clientId}
          setClientId={(v) => setAuthCodePublicClientConfig({ clientId: v })}
          redirectUri={redirectUri}
          scopes={scopes}
          setScopes={(v) => setAuthCodePublicClientConfig({ scopes: v })}
          streamlined={streamlined}
          setStreamlined={(v) => setAuthCodePublicClientConfig({ streamlined: v })}
          pkceEnabled={pkceEnabled}
          setPkceEnabled={(v) => setAuthCodePublicClientConfig({ pkceEnabled: v })}
          resolvedAuthEndpoint={resolvedAuthEndpoint}
          resolvedTokenEndpoint={resolvedTokenEndpoint}
          tenantIdValid={tenantIdValid}
          clientIdValid={clientIdValid}
          redirectUriValid={redirectUriValid}
          safeT={safeStepSettingsT}
          t={tStepSettings}
        />
      )}

      {currentStep === StepIndex.Pkce && (
        pkceEnabled ? (
          <StepPkce
            codeVerifier={codeVerifier}
            setCodeVerifier={(v) => setAuthCodePublicClientRuntime({ codeVerifier: v })}
            codeChallenge={codeChallenge}
            onGeneratePkce={handleGeneratePkce}
          />
        ) : (
          <section>
            <h3 className="mt-0 mb-3">{TranslationUtils.maybeT(tMain, 'pkce.disabled.title', 'PKCE is disabled')}</h3>
            <p className="mb-3">{TranslationUtils.maybeT(tMain, 'pkce.disabled.description', 'Enable PKCE in settings to generate a code verifier and challenge.')}</p>
          </section>
        )
      )}

      {currentStep === StepIndex.Authorize && (
        <StepAuthorize
          responseType={responseType}
          stateParam={stateParam}
          setStateParam={(v) => setAuthCodePublicClientRuntime({ stateParam: v })}
          onGenerateState={handleGenerateState}
          nonce={nonce}
          setNonce={(v) => setAuthCodePublicClientRuntime({ nonce: v })}
          onGenerateNonce={handleGenerateNonce}
          responseMode={responseMode}
          setResponseMode={setResponseMode}
          prompt={prompt}
          setPrompt={setPrompt}
          loginHint={loginHint}
          setLoginHint={setLoginHint}
          authUrlPreview={authUrlPreview}
          onOpenPopup={openAuthorizePopup}
          hideAdvanced={streamlined}
        />
      )}

      {currentStep === StepIndex.Callback && (
        <StepCallback
          callbackUrl={callbackUrl}
          callbackBody={callbackBody}
          authCode={authCode}
          extractedState={extractedState}
          expectedState={stateParam}
        />
      )}

      {currentStep === StepIndex.Tokens && (
        <StepTokens
          tokenRequestPreview={tokenRequestPreview}
          resolvedTokenEndpoint={resolvedTokenEndpoint}
          tokenResponseText={tokenResponseText}
          exchanging={exchanging}
          onExchangeTokens={handleExchangeTokens}
        />
      )}

      {currentStep === StepIndex.Decode && (
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

      {currentStep === StepIndex.Validate && (
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

      {currentStep === StepIndex.CallApi && (
        <StepCallApi
          apiEndpointUrl={apiEndpointUrl}
          setApiEndpointUrl={(v: string) => setAuthCodePublicClientConfig({ apiEndpointUrl: v })}
          accessToken={accessToken}
          apiResponseText={apiResponseText}
          callingApi={callingApi}
          onCallApi={handleCallProtectedApi}
        />
      )}

      {/* Wizard navigation */}
      <div className="flex justify-content-between align-items-center mt-4">
        <Button type="button" label={tMain('buttons.previous')} icon="pi pi-arrow-left" onClick={goPrev} disabled={!canPrev} className="p-button-secondary" />
        <Button type="button" label={tMain('buttons.next')} iconPos="right" icon="pi pi-arrow-right" onClick={goNext} disabled={!canNext} />
      </div>
    </>
  );
}
