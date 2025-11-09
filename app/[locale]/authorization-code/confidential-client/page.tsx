"use client";
import {useEffect, useMemo, useRef, useState} from 'react';
import {useTranslations} from 'next-intl';
import {Card} from 'primereact/card';
import {Steps} from 'primereact/steps';
import type {MenuItem} from 'primereact/menuitem';
import {Button} from 'primereact/button';
import StepOverview from '../public-client/components/StepOverview';
import StepAuthorize from '../public-client/components/StepAuthorize';
import StepCallback from '../public-client/components/StepCallback';
import StepPkce from '../public-client/components/StepPkce';
import StepDecode from '../public-client/components/StepDecode';
import StepValidate from '../public-client/components/StepValidate';
import StepCallApi from '../public-client/components/StepCallApi';
import StepSettings from './components/StepSettings';
import StepTokens from './components/StepTokens';
import StepAuthentication from './components/StepAuthentication';
import { randomCodeVerifier, computeS256Challenge } from '@/utils/pkce';
import { randomUrlSafeString } from '@/utils/random';
import { decodeJwt } from '@/utils/jwtDecode';
import { TranslationUtils } from '@/utils/translation';
import { useSettings } from '@/components/SettingsContext';
import { buildClientAssertion } from '@/utils/jwtSign';

enum StepIndex {
  Overview = 0,
  Settings = 1,
  Pkce = 2,
  Authorize = 3,
  Callback = 4,
  Authentication = 5,
  Tokens = 6,
  Decode = 7,
  Validate = 8,
  CallApi = 9
}

export default function AuthorizationCodeConfidentialClientPage() {
  const t = useTranslations('AuthorizationCode.PublicClient');
  const safeT = (key: string): string => TranslationUtils.safeT(t, key);

  // Wizard state
  const [currentStep, setCurrentStep] = useState<StepIndex>(StepIndex.Settings);
  const [maxCompletedStep, setMaxCompletedStep] = useState<StepIndex>(StepIndex.Overview);

  // Settings persisted/global via SettingsContext
  const {
    authCodeConfidentialClientConfig,
    setAuthCodeConfidentialClientConfig,
    authCodeConfidentialClientRuntime,
    setAuthCodeConfidentialClientRuntime,
    resetAuthCodeConfidentialClientRuntime,
    hydrated
  } = useSettings();

  const tenantId = authCodeConfidentialClientConfig.tenantId || '';
  const clientId = authCodeConfidentialClientConfig.clientId || '';
  const redirectUri = authCodeConfidentialClientConfig.redirectUri || '';
  const scopes = authCodeConfidentialClientConfig.scopes || '';
  const pkceEnabled = !!authCodeConfidentialClientConfig.pkceEnabled;
  const clientAuthMethod = authCodeConfidentialClientConfig.clientAuthMethod || 'secret';
  const clientAssertionKid = authCodeConfidentialClientConfig.clientAssertionKid || '';
  const clientAssertionX5t = authCodeConfidentialClientConfig.clientAssertionX5t || '';

  const authEndpoint = authCodeConfidentialClientRuntime.authEndpoint || 'https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize';
  const tokenEndpoint = authCodeConfidentialClientRuntime.tokenEndpoint || 'https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token';

  // PKCE fields (runtime)
  const codeVerifier = authCodeConfidentialClientRuntime.codeVerifier || '';
  const codeChallenge = authCodeConfidentialClientRuntime.codeChallenge || '';

  // Additional params
  const [responseType] = useState('code');
  const stateParam = authCodeConfidentialClientRuntime.stateParam || '';
  const nonce = authCodeConfidentialClientRuntime.nonce || '';
  const [responseMode, setResponseMode] = useState('');
  const [prompt, setPrompt] = useState('');
  const [loginHint, setLoginHint] = useState('');

  // Client authentication runtime
  const clientSecret = authCodeConfidentialClientRuntime.clientSecret || '';
  const privateKeyPem = authCodeConfidentialClientRuntime.privateKeyPem || '';
  const certificatePem = authCodeConfidentialClientRuntime.certificatePem || '';
  const publicKeyPem = authCodeConfidentialClientRuntime.publicKeyPem || '';
  const thumbprintSha1 = authCodeConfidentialClientRuntime.thumbprintSha1 || '';
  const thumbprintSha256 = authCodeConfidentialClientRuntime.thumbprintSha256 || '';
  const thumbprintSha1Base64Url = authCodeConfidentialClientRuntime.thumbprintSha1Base64Url || '';
  const assertionClaims = authCodeConfidentialClientRuntime.assertionClaims || '';
  const testAssertion = authCodeConfidentialClientRuntime.testAssertion || '';
  const decodedAssertion = authCodeConfidentialClientRuntime.decodedAssertion || '';

  // Callback handling
  const callbackUrl = authCodeConfidentialClientRuntime.callbackUrl || '';
  const callbackBody = authCodeConfidentialClientRuntime.callbackBody || '';
  const authCode = authCodeConfidentialClientRuntime.authCode || '';
  const extractedState = authCodeConfidentialClientRuntime.extractedState || '';
  const callbackValidated = !!authCodeConfidentialClientRuntime.callbackValidated;

  // Token exchange
  const [exchanging, setExchanging] = useState(false);
  const [tokenResponseText, setTokenResponseText] = useState('');
  const accessToken = authCodeConfidentialClientRuntime.accessToken || '';
  const idToken = authCodeConfidentialClientRuntime.idToken || '';

  // Decode tokens (JWT)
  const [decodedAccessHeader, setDecodedAccessHeader] = useState('');
  const [decodedAccessPayload, setDecodedAccessPayload] = useState('');
  const [decodedIdHeader, setDecodedIdHeader] = useState('');
  const [decodedIdPayload, setDecodedIdPayload] = useState('');

  // Call protected API
  const apiEndpointUrl = authCodeConfidentialClientConfig.apiEndpointUrl || 'https://graph.microsoft.com/v1.0/me';
  const [apiResponseText, setApiResponseText] = useState('');
  const [callingApi, setCallingApi] = useState(false);

  // Popup window ref
  const popupRef = useRef<Window | null>(null);

  // Initialize redirectUri from current origin
  useEffect(() => {
    if (typeof window !== 'undefined' && hydrated) {
      const uri = `${window.location.origin}/callback/auth-code`;
      if (!redirectUri) {
        setAuthCodeConfidentialClientConfig(prev => ({ ...prev, redirectUri: uri }));
      }
    }
  }, [redirectUri, setAuthCodeConfidentialClientConfig, hydrated]);

  // Validation helpers
  const isGuid = (s: string) => /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(s);
  const isValidHttpUrl = (s: string) => {
    try { const u = new URL(s); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; }
  };
  const tenantIdValid = tenantId.trim().length > 0 && isGuid(tenantId);
  const clientIdValid = isGuid(clientId);
  const redirectUriValid = isValidHttpUrl(redirectUri);

  // Resolved endpoints
  const resolvedAuthEndpoint = useMemo(() => {
    const tenant = tenantIdValid ? tenantId.trim() : '{tenant}';
    return authEndpoint.replace('{tenant}', tenant);
  }, [authEndpoint, tenantId, tenantIdValid]);
  const resolvedTokenEndpoint = useMemo(() => {
    const tenant = tenantIdValid ? tenantId.trim() : '{tenant}';
    return tokenEndpoint.replace('{tenant}', tenant);
  }, [tokenEndpoint, tenantId, tenantIdValid]);

  // Build authorization URL
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
        const ok = !!code && (!stateParam || stateParam === st);
        setAuthCodeConfidentialClientRuntime(prev => ({
          callbackUrl: urlStr,
          callbackBody: bodyStr,
          authCode: code,
          extractedState: st,
          callbackValidated: (prev.callbackValidated || ok)
        }));
        setCurrentStep(StepIndex.Callback);
        setMaxCompletedStep((m) => Math.max(m, StepIndex.Callback));
      } catch {}
      try { if (popupRef.current && !popupRef.current.closed) popupRef.current.close(); } catch {}
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [stateParam, setAuthCodeConfidentialClientRuntime]);

  const openAuthorizePopup = () => {
    if (!authUrlPreview) return;
    const w = 480; const h = 700;
    const left = window.screenX + (window.outerWidth - w) / 2;
    const top = window.screenY + (window.outerHeight - h) / 2;
    popupRef.current = window.open(
      authUrlPreview,
      'oauth_auth_popup',
      `width=${w},height=${h},left=${left},top=${top}`
    );
    popupRef.current?.focus();
  };

  // Generators for state/nonce and PKCE
  const handleGenerateState = () => setAuthCodeConfidentialClientRuntime({ stateParam: randomUrlSafeString(32) });
  const handleGenerateNonce = () => setAuthCodeConfidentialClientRuntime({ nonce: randomUrlSafeString(32) });
  const handleGeneratePkce = async () => {
    const v = randomCodeVerifier();
    const ch = await computeS256Challenge(v);
    setAuthCodeConfidentialClientRuntime({ codeVerifier: v, codeChallenge: ch });
  };

  // Token request preview (x-www-form-urlencoded)
  const tokenRequestPreview = useMemo(() => {
    if (!clientId || !authCode || !redirectUri) return '';
    const params = new URLSearchParams();
    params.set('grant_type', 'authorization_code');
    params.set('client_id', clientId);
    params.set('code', authCode);
    params.set('redirect_uri', redirectUri);
    if (pkceEnabled && codeVerifier) params.set('code_verifier', codeVerifier);
    if (scopes.trim()) params.set('scope', scopes.trim());
    if (clientAuthMethod === 'secret') {
      params.set('client_secret', clientSecret ? '<redacted>' : '');
    } else {
      params.set('client_assertion_type', 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer');
      params.set('client_assertion', privateKeyPem ? '<signed JWT (generated on send)>' : '');
    }
    return params.toString();
  }, [clientId, authCode, redirectUri, pkceEnabled, codeVerifier, scopes, clientAuthMethod, clientSecret, privateKeyPem]);

  const handleExchangeTokens = async () => {
    if (!authCode || !clientId || !redirectUri || !tokenEndpoint || !tenantIdValid) return;
    if (pkceEnabled && !codeVerifier) return;
    if (clientAuthMethod === 'secret' && !clientSecret) return;
    if (clientAuthMethod === 'certificate' && !privateKeyPem) return;
    setExchanging(true);
    setTokenResponseText('');
    setAuthCodeConfidentialClientRuntime({ accessToken: '', idToken: '' });
    setDecodedAccessHeader(''); setDecodedAccessPayload(''); setDecodedIdHeader(''); setDecodedIdPayload('');
    try {
      const res = await fetch('/api/oauth/exchange-token', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          clientId,
          redirectUri,
          authCode,
          scopes,
          pkceEnabled,
          codeVerifier,
          clientAuthMethod,
          clientSecret,
          privateKeyPem,
          clientAssertionKid,
          clientAssertionX5t,
          tokenEndpoint
        })
      });
      const contentType = res.headers.get('content-type') || '';
      const txt = contentType.includes('application/json') ? JSON.stringify(await res.json(), null, 2) : await res.text();
      setTokenResponseText(txt);
      try {
        const parsed = JSON.parse(txt);
        if (parsed && typeof parsed === 'object' && parsed.access_token) {
          setAuthCodeConfidentialClientRuntime({ accessToken: parsed.access_token as string });
        }
        if (parsed && typeof parsed === 'object' && parsed.id_token) {
          setAuthCodeConfidentialClientRuntime({ idToken: parsed.id_token as string });
        }
      } catch {}
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
    setDecodedAccessHeader(acc.header); setDecodedAccessPayload(acc.payload);
    setDecodedIdHeader(idt.header); setDecodedIdPayload(idt.payload);
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
    resetAuthCodeConfidentialClientRuntime();
    // Reset local component state and wizard progression
    setCurrentStep(StepIndex.Settings);
    setMaxCompletedStep(StepIndex.Overview);
    setResponseMode(''); setPrompt(''); setLoginHint('');
    setTokenResponseText('');
    setDecodedAccessHeader(''); setDecodedAccessPayload(''); setDecodedIdHeader(''); setDecodedIdPayload('');
    setApiResponseText('');
    try { if (popupRef.current && !popupRef.current.closed) popupRef.current.close(); } catch {}
    popupRef.current = null;
  };

  // Start a new flow AND erase persisted settings for this flow (localStorage)
  const handleEraseAll = () => {
    // Reset persisted config to defaults (this writes to localStorage)
    setAuthCodeConfidentialClientConfig({
      tenantId: '',
      clientId: '',
      redirectUri: '',
      scopes: 'openid profile offline_access',
      apiEndpointUrl: 'https://graph.microsoft.com/v1.0/me',
      pkceEnabled: true,
      clientAuthMethod: 'secret',
      clientAssertionKid: '',
      clientAssertionX5t: ''
    });
    // Then do a normal flow reset
    handleResetFlow();
  };

  // Wizard validation per step
  const validators: Record<StepIndex, () => boolean> = {
    [StepIndex.Overview]: () => true,
    [StepIndex.Settings]: () => clientIdValid && redirectUriValid && tenantIdValid,
    [StepIndex.Pkce]: () => pkceEnabled ? (!!codeVerifier && !!codeChallenge) : true,
    [StepIndex.Authorize]: () => callbackValidated || (!!authCode && (!stateParam || stateParam === extractedState)),
    [StepIndex.Callback]: () => callbackValidated || maxCompletedStep >= StepIndex.Tokens || (!!authCode && (!stateParam || stateParam === extractedState)),
    [StepIndex.Authentication]: () => (clientAuthMethod === 'secret' ? (clientSecret.trim().length > 0) : (privateKeyPem.trim().length > 0 && certificatePem.trim().length > 0 && thumbprintSha1.trim().length > 0)),
    [StepIndex.Tokens]: () => !!accessToken,
    [StepIndex.Decode]: () => true,
    [StepIndex.Validate]: () => true,
    [StepIndex.CallApi]: () => false
  };

  const canPrev = currentStep > StepIndex.Overview;
  const canNext = currentStep < StepIndex.CallApi && validators[currentStep]?.();

  const goPrev = () => { if (canPrev) setCurrentStep((s) => (Math.max(StepIndex.Overview, (s as number) - 1) as StepIndex)); };
  const goNext = () => {
    if (!canNext) return;
    setCurrentStep((s) => {
      const next = Math.min(StepIndex.CallApi, (s as number) + 1) as StepIndex;
      setMaxCompletedStep((m) => (Math.max(m as number, next as number) as StepIndex));
      return next;
    });
  };

  const stepLabels = [
    t('steps.overview'),
    t('steps.settings'),
    t('steps.pkce'),
    t('steps.authorize'),
    t('steps.callback'),
    'Authentication',
    t('steps.tokens'),
    t('steps.decode'),
    t('steps.validate'),
    t('steps.callApi')
  ];
  const stepItems: MenuItem[] = stepLabels.map((label, idx) => ({
    label,
    disabled: idx > (maxCompletedStep as number) && idx > (currentStep as number),
    command: () => { if (idx <= (maxCompletedStep as number) || idx <= (currentStep as number)) setCurrentStep(idx as StepIndex); }
  }));

  return (
    <div className="p-4">
      <Card header={
        <div className="flex w-full align-items-center justify-content-between">
          <h2>Authorization Code (Confidential Client)</h2>
          <div className="flex align-items-center gap-2">
            <Button
              type="button"
              className="shadow-2"
              icon="pi pi-undo"
              onClick={handleResetFlow}
              aria-label="Reset"
              title="Reset (keep settings)"
              style={{ transform: 'scale(0.75)', transformOrigin: 'center' }}
            />
            <Button
              type="button"
              className="shadow-2"
              icon="pi pi-eraser"
              severity="danger"
              onClick={handleEraseAll}
              aria-label="Erase"
              title="Erase settings and reset"
              style={{ transform: 'scale(0.75)', transformOrigin: 'center' }}
            />
          </div>
        </div>
      }>
        {/* Steps header */}
        <div className="step-header">
          <Steps model={stepItems} activeIndex={currentStep} readOnly={false} />
        </div>

        {/* Step content */}
        {currentStep === StepIndex.Overview && (<StepOverview />)}

        {currentStep === StepIndex.Settings && (
          <StepSettings
            tenantId={tenantId}
            setTenantId={(v: string) => setAuthCodeConfidentialClientConfig({ tenantId: v })}
            clientId={clientId}
            setClientId={(v: string) => setAuthCodeConfidentialClientConfig({ clientId: v })}
            redirectUri={redirectUri}
            scopes={scopes}
            setScopes={(v: string) => setAuthCodeConfidentialClientConfig({ scopes: v })}
            pkceEnabled={pkceEnabled}
            setPkceEnabled={(v: boolean) => setAuthCodeConfidentialClientConfig({ pkceEnabled: v })}
            resolvedAuthEndpoint={resolvedAuthEndpoint}
            resolvedTokenEndpoint={resolvedTokenEndpoint}
            tenantIdValid={tenantIdValid}
            clientIdValid={clientIdValid}
            redirectUriValid={redirectUriValid}
            safeT={safeT}
          />
        )}

        {currentStep === StepIndex.Pkce && (
          pkceEnabled ? (
            <StepPkce
              codeVerifier={codeVerifier}
              setCodeVerifier={(v) => setAuthCodeConfidentialClientRuntime({ codeVerifier: v })}
              codeChallenge={codeChallenge}
              onGeneratePkce={handleGeneratePkce}
            />
          ) : (
            <section>
              <h3 className="mt-0 mb-3">PKCE</h3>
              <p className="mb-3">PKCE is disabled for this flow. You can enable it in Settings.</p>
            </section>
          )
        )}


        {currentStep === StepIndex.Authorize && (
          <StepAuthorize
            responseType={responseType}
            stateParam={stateParam}
            setStateParam={(v) => setAuthCodeConfidentialClientRuntime({ stateParam: v })}
            onGenerateState={handleGenerateState}
            nonce={nonce}
            setNonce={(v) => setAuthCodeConfidentialClientRuntime({ nonce: v })}
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

        {currentStep === StepIndex.Callback && (
          <StepCallback
            callbackUrl={callbackUrl}
            callbackBody={callbackBody}
            authCode={authCode}
            extractedState={extractedState}
            expectedState={stateParam}
          />
        )}

        {currentStep === StepIndex.Authentication && (
          <StepAuthentication
            clientAuthMethod={clientAuthMethod}
            setClientAuthMethod={(v: 'secret' | 'certificate') => setAuthCodeConfidentialClientConfig({ clientAuthMethod: v })}
            clientSecret={clientSecret}
            setClientSecret={(v: string) => setAuthCodeConfidentialClientRuntime({ clientSecret: v })}
            privateKeyPem={privateKeyPem}
            setPrivateKeyPem={(v: string) => setAuthCodeConfidentialClientRuntime({ privateKeyPem: v })}
            certificatePem={certificatePem}
            setCertificatePem={(v: string) => setAuthCodeConfidentialClientRuntime({ certificatePem: v })}
            clientAssertionKid={clientAssertionKid}
            setClientAssertionKid={(v: string) => setAuthCodeConfidentialClientConfig({ clientAssertionKid: v })}
            clientAssertionX5t={clientAssertionX5t}
            setClientAssertionX5t={(v: string) => setAuthCodeConfidentialClientConfig({ clientAssertionX5t: v })}
            publicKeyPem={publicKeyPem}
            setPublicKeyPem={(v: string) => setAuthCodeConfidentialClientRuntime({ publicKeyPem: v })}
            thumbprintSha1={thumbprintSha1}
            setThumbprintSha1={(v: string) => setAuthCodeConfidentialClientRuntime({ thumbprintSha1: v })}
            thumbprintSha256={thumbprintSha256}
            setThumbprintSha256={(v: string) => setAuthCodeConfidentialClientRuntime({ thumbprintSha256: v })}
            thumbprintSha1Base64Url={thumbprintSha1Base64Url}
            setThumbprintSha1Base64Url={(v: string) => setAuthCodeConfidentialClientRuntime({ thumbprintSha1Base64Url: v })}
            assertionClaims={assertionClaims}
            setAssertionClaims={(v: string) => setAuthCodeConfidentialClientRuntime({ assertionClaims: v })}
            testAssertion={testAssertion}
            setTestAssertion={(v: string) => setAuthCodeConfidentialClientRuntime({ testAssertion: v })}
            decodedAssertion={decodedAssertion}
            setDecodedAssertion={(v: string) => setAuthCodeConfidentialClientRuntime({ decodedAssertion: v })}
            clientId={clientId}
            tokenEndpoint={resolvedTokenEndpoint}
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
            setApiEndpointUrl={(v) => setAuthCodeConfidentialClientConfig({ apiEndpointUrl: v })}
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
