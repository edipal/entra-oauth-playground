"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Steps } from 'primereact/steps';
import type { MenuItem } from 'primereact/menuitem';
import { Button } from 'primereact/button';
import StepOverview from '@/components/steps/StepOverview';
import StepSettings from '@/components/steps/StepSettings';
import StepAuthentication from '@/components/steps/StepAuthentication';
import StepTokens from '@/components/steps/StepTokens';
import StepDecode from '@/components/steps/StepDecode';
import StepValidate from '@/components/steps/StepValidate';
import StepCallApi from '@/components/steps/StepCallApi';
import { decodeJwt } from '@/lib/jwtDecode';
import { TranslationUtils } from '@/lib/translation';
import { useSettings } from '@/components/SettingsContext';

enum StepIndex {
  Overview = 0,
  Settings = 1,
  Authentication = 2,
  Tokens = 3,
  Decode = 4,
  Validate = 5,
  CallApi = 6
}

export default function ClientCredentialsPage() {
  const t = useTranslations('ClientCredentials.Main');
  const tStepSettings = useTranslations('StepSettings');

  // Helper to return literal strings for StepSettings even if they contain {tenant}
  const safeStepSettingsT = (key: string): string => TranslationUtils.safeT(tStepSettings, key);

  // Settings persisted/global via SettingsContext
  const {
    clientCredentialsConfig,
    setClientCredentialsConfig,
    clientCredentialsRuntime,
    setClientCredentialsRuntime,
    resetClientCredentialsRuntime
  } = useSettings();

  // Wizard state
  const [currentStep, setCurrentStep] = useState<StepIndex>(StepIndex.Settings);
  const [maxCompletedStep, setMaxCompletedStep] = useState<StepIndex>(StepIndex.Overview);

  const tenantId = clientCredentialsConfig.tenantId || '';
  const clientId = clientCredentialsConfig.clientId || '';
  const scopes = clientCredentialsConfig.scopes || '';
  const streamlined = !!clientCredentialsConfig.streamlined;
  const clientAuthMethod = clientCredentialsConfig.clientAuthMethod || 'secret';
  const clientAssertionKid = clientCredentialsConfig.clientAssertionKid || '';
  const clientAssertionX5t = clientCredentialsConfig.clientAssertionX5t || '';

  const tokenEndpoint = clientCredentialsRuntime.tokenEndpoint || 'https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token';

  // Client authentication runtime
  const clientSecret = clientCredentialsRuntime.clientSecret || '';
  const privateKeyPem = clientCredentialsRuntime.privateKeyPem || '';
  const certificatePem = clientCredentialsRuntime.certificatePem || '';
  const publicKeyPem = clientCredentialsRuntime.publicKeyPem || '';
  const thumbprintSha1 = clientCredentialsRuntime.thumbprintSha1 || '';
  const thumbprintSha256 = clientCredentialsRuntime.thumbprintSha256 || '';
  const thumbprintSha1Base64Url = clientCredentialsRuntime.thumbprintSha1Base64Url || '';
  const assertionClaims = clientCredentialsRuntime.assertionClaims || '';
  const testAssertion = clientCredentialsRuntime.testAssertion || '';
  const decodedAssertion = clientCredentialsRuntime.decodedAssertion || '';

  // Token exchange
  const [exchanging, setExchanging] = useState(false);
  const [tokenResponseText, setTokenResponseText] = useState('');
  const accessToken = clientCredentialsRuntime.accessToken || '';
  const idToken = clientCredentialsRuntime.idToken || '';

  // Decode tokens (JWT)
  const [decodedAccessHeader, setDecodedAccessHeader] = useState('');
  const [decodedAccessPayload, setDecodedAccessPayload] = useState('');
  const [decodedIdHeader, setDecodedIdHeader] = useState('');
  const [decodedIdPayload, setDecodedIdPayload] = useState('');

  // Call protected API
  const apiEndpointUrl = clientCredentialsConfig.apiEndpointUrl || 'https://graph.microsoft.com/v1.0/users';
  const [apiResponseText, setApiResponseText] = useState('');
  const [callingApi, setCallingApi] = useState(false);

  // Validation helpers
  const isGuid = (s: string) => /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(s);
  const tenantIdValid = tenantId.trim().length > 0 && isGuid(tenantId);
  const clientIdValid = isGuid(clientId);
  const scopesValid = scopes.trim().length > 0;

  // Resolved token endpoint
  const resolvedTokenEndpoint = useMemo(() => {
    const tenant = tenantIdValid ? tenantId.trim() : '{tenant}';
    return tokenEndpoint.replace('{tenant}', tenant);
  }, [tokenEndpoint, tenantId, tenantIdValid]);

  // Streamlined: when on Tokens step, auto exchange tokens once inputs are ready
  const autoExchangedRef = useRef(false);
  const autoAdvancedFromTokensRef = useRef(false);
  useEffect(() => {
    if (!streamlined) return;
    if (currentStep !== StepIndex.Tokens) return;
    if (accessToken && !autoAdvancedFromTokensRef.current) {
      autoAdvancedFromTokensRef.current = true;
      setCurrentStep(StepIndex.Decode);
      setMaxCompletedStep((m) => (Math.max(m as number, StepIndex.Decode as number) as StepIndex));
      return;
    }
    if (autoExchangedRef.current) return;
    if (!exchanging && clientId && tenantIdValid && scopesValid && tokenEndpoint && (clientAuthMethod === 'secret' ? clientSecret : privateKeyPem)) {
      autoExchangedRef.current = true;
      void handleExchangeTokens();
    }
  }, [streamlined, currentStep, exchanging, clientId, tenantIdValid, scopesValid, tokenEndpoint, clientAuthMethod, clientSecret, privateKeyPem, accessToken]);

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

  // Token request preview (x-www-form-urlencoded)
  const tokenRequestPreview = useMemo(() => {
    if (!clientId || !scopes.trim()) return '';
    const params = new URLSearchParams();
    params.set('grant_type', 'client_credentials');
    params.set('client_id', clientId);
    params.set('scope', scopes.trim());
    if (clientAuthMethod === 'secret') {
      params.set('client_secret', clientSecret ? '<redacted>' : '');
    } else {
      params.set('client_assertion_type', 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer');
      params.set('client_assertion', privateKeyPem ? '<signed JWT (generated on send)>' : '');
    }
    return params.toString();
  }, [clientId, scopes, clientAuthMethod, clientSecret, privateKeyPem]);

  const handleExchangeTokens = async () => {
    if (!clientId || !tenantIdValid || !scopesValid || !tokenEndpoint) return;
    if (clientAuthMethod === 'secret' && !clientSecret) return;
    if (clientAuthMethod === 'certificate' && !privateKeyPem) return;
    setExchanging(true);
    setTokenResponseText('');
    setClientCredentialsRuntime({ accessToken: '', idToken: '' });
    setDecodedAccessHeader('');
    setDecodedAccessPayload('');
    setDecodedIdHeader('');
    setDecodedIdPayload('');
    try {
      const res = await fetch('/api/oauth/client-credentials', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          clientId,
          scopes,
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
          setClientCredentialsRuntime({ accessToken: parsed.access_token as string });
        }
        if (parsed && typeof parsed === 'object' && parsed.id_token) {
          setClientCredentialsRuntime({ idToken: parsed.id_token as string });
        }
      } catch { }
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
    resetClientCredentialsRuntime();
    setCurrentStep(StepIndex.Settings);
    setMaxCompletedStep(StepIndex.Overview);
    setTokenResponseText('');
    setDecodedAccessHeader('');
    setDecodedAccessPayload('');
    setDecodedIdHeader('');
    setDecodedIdPayload('');
    setApiResponseText('');
    try {
      autoExchangedRef.current = false;
      autoDecodedRef.current = false;
      (autoAdvancedFromTokensRef as any)?.current !== undefined && ((autoAdvancedFromTokensRef as any).current = false);
      (autoAdvancedFromDecodeRef as any)?.current !== undefined && ((autoAdvancedFromDecodeRef as any).current = false);
    } catch { }
  };

  // Start a new flow AND erase persisted settings for this flow (localStorage)
  const handleEraseAll = () => {
    setClientCredentialsConfig({
      tenantId: '',
      clientId: '',
      scopes: 'https://graph.microsoft.com/.default',
      apiEndpointUrl: 'https://graph.microsoft.com/v1.0/users',
      streamlined: false,
      clientAuthMethod: 'secret',
      clientAssertionKid: '',
      clientAssertionX5t: '',
      pkceEnabled: false
    });
    handleResetFlow();
  };

  // Wizard validation per step
  const validators: Record<StepIndex, () => boolean> = {
    [StepIndex.Overview]: () => true,
    [StepIndex.Settings]: () => clientIdValid && tenantIdValid && scopesValid,
    [StepIndex.Authentication]: () => (clientAuthMethod === 'secret' ? (clientSecret.trim().length > 0) : (privateKeyPem.trim().length > 0 && certificatePem.trim().length > 0 && thumbprintSha1.trim().length > 0)),
    [StepIndex.Tokens]: () => !!accessToken,
    [StepIndex.Decode]: () => {
      const hasAccessToken = !!accessToken;
      const hasIdToken = !!idToken;
      const accessDecoded = !!decodedAccessPayload;
      const idDecoded = !!decodedIdPayload;

      if (!hasAccessToken && !hasIdToken) return false;
      if (hasAccessToken && hasIdToken) return accessDecoded && idDecoded;
      if (hasAccessToken) return accessDecoded;
      return idDecoded;
    },
    [StepIndex.Validate]: () => true,
    [StepIndex.CallApi]: () => false
  };

  const canPrev = currentStep > StepIndex.Overview;
  const canNext = currentStep < StepIndex.CallApi && validators[currentStep]?.();

  const goPrev = () => { if (canPrev) setCurrentStep((s) => (Math.max(StepIndex.Overview, (s as number) - 1) as StepIndex)); };
  const goNext = () => {
    if (!canNext) return;
    if (streamlined && currentStep === StepIndex.Settings) {
      setCurrentStep(StepIndex.Authentication);
      setMaxCompletedStep((m) => (Math.max(m as number, StepIndex.Authentication as number) as StepIndex));
      return;
    }
    setCurrentStep((s) => {
      const next = Math.min(StepIndex.CallApi, (s as number) + 1) as StepIndex;
      setMaxCompletedStep((m) => (Math.max(m as number, next as number) as StepIndex));
      return next;
    });
  };

  const stepLabels = [
    t('steps.overview'),
    t('steps.settings'),
    t('steps.authentication'),
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
    <>
      <div className="flex w-full align-items-center justify-content-between">
        <h4>{t('title')}</h4>
        <div className="flex align-items-center gap-2">
          <Button
            type="button"
            className="shadow-2"
            icon="pi pi-undo"
            onClick={handleResetFlow}
            aria-label={t('header.resetAria')}
            title={t('header.resetTitle')}
            style={{ transform: 'scale(0.75)', transformOrigin: 'center' }}
          />
          <Button
            type="button"
            className="shadow-2"
            icon="pi pi-eraser"
            severity="danger"
            onClick={handleEraseAll}
            aria-label={t('header.eraseAria')}
            title={t('header.eraseTitle')}
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
          flowIntro={t('overview.flowIntro')}
          flowDiagram={t('overview.flowDiagram')}
        />
      )}

      {currentStep === StepIndex.Settings && (
        <StepSettings
          tenantId={tenantId}
          setTenantId={(v: string) => setClientCredentialsConfig({ tenantId: v })}
          clientId={clientId}
          setClientId={(v: string) => setClientCredentialsConfig({ clientId: v })}
          redirectUri=""
          scopes={scopes}
          setScopes={(v: string) => setClientCredentialsConfig({ scopes: v })}
          streamlined={streamlined}
          setStreamlined={(v: boolean) => setClientCredentialsConfig({ streamlined: v })}
          pkceEnabled={false}
          setPkceEnabled={() => setClientCredentialsConfig({ pkceEnabled: false })}
          resolvedAuthEndpoint=""
          resolvedTokenEndpoint={resolvedTokenEndpoint}
          tenantIdValid={tenantIdValid}
          clientIdValid={clientIdValid}
          redirectUriValid={true}
          t={tStepSettings}
          safeT={safeStepSettingsT}
          showPkceToggle={false}
          showRedirectUri={false}
          showAuthEndpoint={false}
        />
      )}

      {currentStep === StepIndex.Authentication && (
        <StepAuthentication
          clientAuthMethod={clientAuthMethod}
          setClientAuthMethod={(v: 'secret' | 'certificate') => setClientCredentialsConfig({ clientAuthMethod: v })}
          clientSecret={clientSecret}
          setClientSecret={(v: string) => setClientCredentialsRuntime({ clientSecret: v })}
          privateKeyPem={privateKeyPem}
          setPrivateKeyPem={(v: string) => setClientCredentialsRuntime({ privateKeyPem: v })}
          certificatePem={certificatePem}
          setCertificatePem={(v: string) => setClientCredentialsRuntime({ certificatePem: v })}
          clientAssertionKid={clientAssertionKid}
          setClientAssertionKid={(v: string) => setClientCredentialsConfig({ clientAssertionKid: v })}
          clientAssertionX5t={clientAssertionX5t}
          setClientAssertionX5t={(v: string) => setClientCredentialsConfig({ clientAssertionX5t: v })}
          publicKeyPem={publicKeyPem}
          setPublicKeyPem={(v: string) => setClientCredentialsRuntime({ publicKeyPem: v })}
          thumbprintSha1={thumbprintSha1}
          setThumbprintSha1={(v: string) => setClientCredentialsRuntime({ thumbprintSha1: v })}
          thumbprintSha256={thumbprintSha256}
          setThumbprintSha256={(v: string) => setClientCredentialsRuntime({ thumbprintSha256: v })}
          thumbprintSha1Base64Url={thumbprintSha1Base64Url}
          setThumbprintSha1Base64Url={(v: string) => setClientCredentialsRuntime({ thumbprintSha1Base64Url: v })}
          assertionClaims={assertionClaims}
          setAssertionClaims={(v: string) => setClientCredentialsRuntime({ assertionClaims: v })}
          testAssertion={testAssertion}
          setTestAssertion={(v: string) => setClientCredentialsRuntime({ testAssertion: v })}
          decodedAssertion={decodedAssertion}
          setDecodedAssertion={(v: string) => setClientCredentialsRuntime({ decodedAssertion: v })}
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
          expectedNonce=""
          isClientCredentials={true}
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
          setApiEndpointUrl={(v: string) => setClientCredentialsConfig({ apiEndpointUrl: v })}
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
    </>
  );
}
