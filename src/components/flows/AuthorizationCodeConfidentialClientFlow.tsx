"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Steps } from "primereact/steps";
import type { MenuItem } from "primereact/menuitem";
import { Button } from "primereact/button";
import StepOverview from "@/components/steps/StepOverview";
import StepAuthorize from "@/components/steps/StepAuthorize";
import StepCallback from "@/components/steps/StepCallback";
import StepPkce from "@/components/steps/StepPkce";
import StepDecode from "@/components/steps/StepDecode";
import StepValidate from "@/components/steps/StepValidate";
import StepCallApi from "@/components/steps/StepCallApi";
import StepSettings from "@/components/steps/StepSettings";
import StepTokens from "@/components/steps/StepTokens";
import StepAuthentication from "@/components/steps/StepAuthentication";
import Auth0AuthorizationRequestOptions from "@/components/steps/auth0/StepAuthorizationRequestOptions";
import { randomCodeVerifier, computeS256Challenge } from "@/lib/pkce";
import { randomUrlSafeString } from "@/lib/random";
import { decodeJwt, type DecodedTokenFormat } from "@/lib/jwtDecode";
import { TranslationUtils } from "@/lib/translation";
import { useSettings } from "@/components/SettingsContext";
import { useProviderMetadata } from "@/hooks/useProviderMetadata";
import type { IdentityProviderId } from "@/lib/identityProvider";
import {
  DEFAULT_PROVIDER_ID,
  getClientAssertionAudience,
  getProviderDefaultApiEndpoint,
  getProviderDefaultScopes,
  isClientIdValidForProvider,
  isEntraProvider,
  isProviderConfigValid,
  resolveProviderAuthEndpoint,
  resolveProviderTokenEndpoint,
} from "@/lib/identityProvider";
import {
  appendAuth0AuthorizationParameters,
  DEFAULT_AUTH0_AUTHORIZATION_PARAMETERS,
  type Auth0AuthorizationParameters,
} from "@/lib/auth0AuthorizationParameters";
import {
  MAX_AUTHORIZATION_DETAILS_LENGTH,
  validateAuthorizationDetails,
} from "@/lib/authorizationDetails";

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
  CallApi = 9,
}

export default function AuthorizationCodeConfidentialClientPage() {
  const t = useTranslations("AuthorizationCode.ConfidentialClient.Main");
  const tStepSettings = useTranslations("StepSettings");
  const tAuth0Options = useTranslations("Auth0AuthorizationOptions");

  // Helper to return literal strings for StepSettings even if they contain {tenant}
  const safeStepSettingsT = (key: string): string =>
    TranslationUtils.safeT(tStepSettings, key);

  // Wizard state
  const [currentStep, setCurrentStep] = useState<StepIndex>(StepIndex.Settings);
  const [maxCompletedStep, setMaxCompletedStep] = useState<StepIndex>(
    StepIndex.Overview,
  );

  // Settings persisted/global via SettingsContext
  const {
    authCodeConfidentialClientConfig,
    setAuthCodeConfidentialClientConfig,
    authCodeConfidentialClientRuntime,
    setAuthCodeConfidentialClientRuntime,
    resetAuthCodeConfidentialClientRuntime,
    hydrated,
  } = useSettings();

  const providerId =
    authCodeConfidentialClientConfig.providerId || DEFAULT_PROVIDER_ID;
  const issuerUrl = authCodeConfidentialClientConfig.issuerUrl || "";
  const audience = authCodeConfidentialClientConfig.audience || "";
  const endpointOverrideEnabled =
    !!authCodeConfidentialClientConfig.endpointOverrideEnabled;
  const authEndpointOverride =
    authCodeConfidentialClientConfig.authEndpointOverride || "";
  const tokenEndpointOverride =
    authCodeConfidentialClientConfig.tokenEndpointOverride || "";
  const providerMetadata = useProviderMetadata(providerId, issuerUrl);

  const tenantId = authCodeConfidentialClientConfig.tenantId || "";
  const clientId = authCodeConfidentialClientConfig.clientId || "";
  const redirectUri = authCodeConfidentialClientConfig.redirectUri || "";
  const scopes = authCodeConfidentialClientConfig.scopes || "";
  const streamlined = !!authCodeConfidentialClientConfig.streamlined;
  const pkceEnabled = !!authCodeConfidentialClientConfig.pkceEnabled;
  const authRequestMode =
    authCodeConfidentialClientConfig.authRequestMode || "url";
  const rarJson = authCodeConfidentialClientConfig.rarJson || "";
  const clientAuthMethod =
    authCodeConfidentialClientConfig.clientAuthMethod || "secret";
  const clientAssertionKid =
    authCodeConfidentialClientConfig.clientAssertionKid || "";
  const clientAssertionX5t =
    authCodeConfidentialClientConfig.clientAssertionX5t || "";

  const authEndpoint = resolveProviderAuthEndpoint({
    providerId,
    tenantId,
    metadata: providerMetadata.metadata,
    endpointOverrideEnabled,
    authEndpointOverride,
  });
  const tokenEndpoint = resolveProviderTokenEndpoint({
    providerId,
    tenantId,
    metadata: providerMetadata.metadata,
    endpointOverrideEnabled,
    tokenEndpointOverride,
  });

  // PKCE fields (runtime)
  const codeVerifier = authCodeConfidentialClientRuntime.codeVerifier || "";
  const codeChallenge = authCodeConfidentialClientRuntime.codeChallenge || "";

  // Additional params
  const [responseType] = useState("code");
  const stateParam = authCodeConfidentialClientRuntime.stateParam || "";
  const nonce = authCodeConfidentialClientRuntime.nonce || "";
  const [responseMode, setResponseMode] = useState("");
  const [prompt, setPrompt] = useState("");
  const [loginHint, setLoginHint] = useState("");
  const [authorizationLaunchError, setAuthorizationLaunchError] = useState("");
  const [auth0AuthorizationParameters, setAuth0AuthorizationParameters] =
    useState<Auth0AuthorizationParameters>({
      ...DEFAULT_AUTH0_AUTHORIZATION_PARAMETERS,
    });

  // Client authentication runtime
  const clientSecret = authCodeConfidentialClientRuntime.clientSecret || "";
  const privateKeyPem = authCodeConfidentialClientRuntime.privateKeyPem || "";
  const certificatePem = authCodeConfidentialClientRuntime.certificatePem || "";
  const publicKeyPem = authCodeConfidentialClientRuntime.publicKeyPem || "";
  const thumbprintSha1 = authCodeConfidentialClientRuntime.thumbprintSha1 || "";
  const thumbprintSha1Base64Url =
    authCodeConfidentialClientRuntime.thumbprintSha1Base64Url || "";
  const assertionClaims =
    authCodeConfidentialClientRuntime.assertionClaims || "";
  const testAssertion = authCodeConfidentialClientRuntime.testAssertion || "";
  const decodedAssertion =
    authCodeConfidentialClientRuntime.decodedAssertion || "";

  // Callback handling
  const callbackUrl = authCodeConfidentialClientRuntime.callbackUrl || "";
  const callbackBody = authCodeConfidentialClientRuntime.callbackBody || "";
  const authCode = authCodeConfidentialClientRuntime.authCode || "";
  const extractedState = authCodeConfidentialClientRuntime.extractedState || "";
  const callbackValidated =
    !!authCodeConfidentialClientRuntime.callbackValidated;

  // Token exchange
  const [exchanging, setExchanging] = useState(false);
  const [tokenResponseText, setTokenResponseText] = useState("");
  const accessToken = authCodeConfidentialClientRuntime.accessToken || "";
  const idToken = authCodeConfidentialClientRuntime.idToken || "";

  // Decode tokens (JWT/JWE)
  const [decodedAccessHeader, setDecodedAccessHeader] = useState("");
  const [decodedAccessPayload, setDecodedAccessPayload] = useState("");
  const [decodedAccessFormat, setDecodedAccessFormat] =
    useState<DecodedTokenFormat>("invalid");
  const [decodedIdHeader, setDecodedIdHeader] = useState("");
  const [decodedIdPayload, setDecodedIdPayload] = useState("");
  const [decodedIdFormat, setDecodedIdFormat] =
    useState<DecodedTokenFormat>("invalid");

  // Call protected API
  const apiEndpointUrl =
    authCodeConfidentialClientConfig.apiEndpointUrl ||
    getProviderDefaultApiEndpoint(providerId, "authCode");
  const [apiResponseText, setApiResponseText] = useState("");
  const [callingApi, setCallingApi] = useState(false);

  // Popup window ref
  const popupRef = useRef<Window | null>(null);

  // Initialize redirectUri from current origin
  useEffect(() => {
    if (globalThis.window !== undefined && hydrated) {
      const uri = `${globalThis.window.location.origin}/callback/auth-code`;
      if (!redirectUri) {
        setAuthCodeConfidentialClientConfig((prev) => ({
          ...prev,
          redirectUri: uri,
        }));
      }
    }
  }, [redirectUri, setAuthCodeConfidentialClientConfig, hydrated]);

  useEffect(() => {
    if (isEntraProvider(providerId)) return;
    if (!providerMetadata.metadata?.userinfo_endpoint) return;
    if (apiEndpointUrl) return;

    setAuthCodeConfidentialClientConfig({
      apiEndpointUrl: providerMetadata.metadata.userinfo_endpoint,
    });
  }, [
    apiEndpointUrl,
    providerId,
    providerMetadata.metadata?.userinfo_endpoint,
    setAuthCodeConfidentialClientConfig,
  ]);

  // Validation helpers
  const isValidHttpUrl = (s: string) => {
    try {
      const u = new URL(s);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  };
  const isEntra = isEntraProvider(providerId);
  const tenantIdValid = isProviderConfigValid({ providerId, tenantId });
  const issuerUrlValid =
    isEntra || isProviderConfigValid({ providerId, issuerUrl });
  const providerConfigValid = isProviderConfigValid({
    providerId,
    tenantId,
    issuerUrl,
  });
  const clientIdValid = isClientIdValidForProvider(providerId, clientId);
  const redirectUriValid = isValidHttpUrl(redirectUri);

  const resolvedAuthEndpoint = authEndpoint;
  const resolvedTokenEndpoint = tokenEndpoint;

  // Entra signs the assertion for the token endpoint; Auth0 for the tenant URL.
  const assertionAudience = getClientAssertionAudience(providerId, {
    issuerUrl,
    tokenEndpoint,
  });
  // Auth0 identifies the signing key by its own kid and has no certificate.
  const clientCertificateCredentialValid =
    providerId === "auth0"
      ? clientAssertionKid.trim().length > 0
      : certificatePem.trim().length > 0 && thumbprintSha1.trim().length > 0;

  const setAuth0AuthorizationParameter = useCallback(
    (name: keyof Auth0AuthorizationParameters, value: string) => {
      setAuth0AuthorizationParameters((prev) => ({ ...prev, [name]: value }));
    },
    [],
  );

  // Rich Authorization Requests JSON is user-authored, so it is validated before it
  // can reach the authorization URL, a pushed authorization request, or a request object.
  const rarValidation = useMemo(
    () => validateAuthorizationDetails(rarJson),
    [rarJson],
  );
  const rarInvalid = !isEntra && rarValidation.status === "invalid";
  const rarError =
    rarValidation.status === "invalid" && !isEntra
      ? tAuth0Options(`errors.${rarValidation.errorKey}`, {
          max: MAX_AUTHORIZATION_DETAILS_LENGTH,
        })
      : "";

  // Build authorization URL
  const authUrlPreview = useMemo(() => {
    if (!clientIdValid || !providerConfigValid || !authEndpoint) return "";

    let url: URL;
    try {
      url = new URL(authEndpoint);
    } catch {
      return "";
    }

    url.searchParams.set("client_id", clientId);
    url.searchParams.set("response_type", responseType);
    url.searchParams.set("redirect_uri", redirectUri);
    if (scopes.trim()) url.searchParams.set("scope", scopes.trim());
    if (stateParam) url.searchParams.set("state", stateParam);
    if (nonce) url.searchParams.set("nonce", nonce);
    if (audience.trim()) url.searchParams.set("audience", audience.trim());
    if (!isEntra && rarValidation.status === "valid") {
      url.searchParams.set("authorization_details", rarValidation.value);
    }
    if (prompt) url.searchParams.set("prompt", prompt);
    if (loginHint) url.searchParams.set("login_hint", loginHint);
    if (isEntra && responseMode) {
      url.searchParams.set("response_mode", responseMode);
    }
    if (!isEntra) {
      appendAuth0AuthorizationParameters(
        url.searchParams,
        auth0AuthorizationParameters,
      );
    }
    if (pkceEnabled && codeChallenge) {
      url.searchParams.set("code_challenge", codeChallenge);
      url.searchParams.set("code_challenge_method", "S256");
    }
    return url.toString();
  }, [
    authEndpoint,
    audience,
    clientId,
    clientIdValid,
    codeChallenge,
    auth0AuthorizationParameters,
    isEntra,
    nonce,
    rarValidation,
    redirectUri,
    responseMode,
    prompt,
    loginHint,
    responseType,
    scopes,
    stateParam,
    providerConfigValid,
    pkceEnabled,
  ]);

  // Listen for postMessage from callback window
  useEffect(() => {
    const handleOAuthCallback = (data: any) => {
      let urlStr = "";
      if (typeof data.url === "string") {
        urlStr = data.url;
      } else if (typeof data.href === "string") {
        urlStr = data.href;
      }
      if (!urlStr) return;

      const bodyStr: string = typeof data.body === "string" ? data.body : "";
      let code = "";
      let st = "";

      if (bodyStr) {
        const p = new URLSearchParams(bodyStr);
        code = p.get("code") || "";
        st = p.get("state") || "";
      } else {
        const u = new URL(urlStr);
        code = u.searchParams.get("code") || "";
        st = u.searchParams.get("state") || "";
      }

      const ok = !!code && (!stateParam || stateParam === st);

      setAuthCodeConfidentialClientRuntime((prev) => ({
        callbackUrl: urlStr,
        callbackBody: bodyStr,
        authCode: code,
        extractedState: st,
        callbackValidated: prev.callbackValidated || ok,
      }));

      const stepIndex =
        streamlined && ok ? StepIndex.Authentication : StepIndex.Callback;
      setCurrentStep(stepIndex);
      setMaxCompletedStep((m) => Math.max(m, stepIndex));
    };

    const onMessage = (ev: MessageEvent) => {
      const data = ev.data;
      if (ev.origin !== globalThis.window?.location.origin) return;
      if (data?.type !== "oauth_callback") return;

      try {
        handleOAuthCallback(data);
      } catch {}

      try {
        if (popupRef.current && !popupRef.current.closed) {
          popupRef.current.close();
        }
      } catch {}
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [stateParam, setAuthCodeConfidentialClientRuntime, streamlined]);

  const resolveAuthorizationLaunchUrl = async () => {
    setAuthorizationLaunchError("");

    if (rarInvalid) {
      setAuthorizationLaunchError(rarError);
      return "";
    }

    if (
      providerId !== "auth0" ||
      (authRequestMode !== "par" &&
        authRequestMode !== "jar" &&
        authRequestMode !== "par-jar")
    ) {
      return authUrlPreview;
    }

    try {
      const previewUrl = new URL(authUrlPreview);
      let authorizationParams = Object.fromEntries(
        previewUrl.searchParams.entries(),
      );

      if (authRequestMode === "jar" || authRequestMode === "par-jar") {
        if (!privateKeyPem) {
          throw new Error(
            tAuth0Options("errors.requestObjectMissingPrivateKey"),
          );
        }

        const requestObjectResponse = await fetch(
          "/api/oauth/auth0/request-object",
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              issuerUrl,
              clientId,
              authorizationParams,
              privateKeyPem,
              kid: clientAssertionKid,
            }),
            cache: "no-store",
          },
        );
        if (!requestObjectResponse.ok) {
          throw new Error(tAuth0Options("errors.requestObjectFailed"));
        }
        const requestObjectJson = await requestObjectResponse.json();
        if (!requestObjectJson?.request) {
          throw new Error(tAuth0Options("errors.requestObjectMissing"));
        }

        if (authRequestMode === "jar") {
          const url = new URL(authEndpoint);
          url.searchParams.set("client_id", clientId);
          url.searchParams.set("request", String(requestObjectJson.request));
          return url.toString();
        }

        authorizationParams = {
          client_id: clientId,
          request: String(requestObjectJson.request),
        };
      }

      const response = await fetch("/api/oauth/auth0/par", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          issuerUrl,
          authorizationParams,
          clientAuthMethod,
          clientSecret,
          privateKeyPem,
          clientAssertionKid,
          clientAssertionX5t,
        }),
        cache: "no-store",
      });
      if (!response.ok) throw new Error(tAuth0Options("errors.parFailed"));
      const json = await response.json();
      if (!json?.request_uri) {
        throw new Error(tAuth0Options("errors.parMissingRequestUri"));
      }

      const url = new URL(authEndpoint);
      url.searchParams.set("client_id", clientId);
      url.searchParams.set("request_uri", String(json.request_uri));
      return url.toString();
    } catch (error) {
      setAuthorizationLaunchError(
        error instanceof Error
          ? error.message
          : tAuth0Options("errors.launchFailed"),
      );
      return "";
    }
  };

  const openAuthorizePopup = async () => {
    if (!authUrlPreview) return;

    const popup = globalThis.window.open("", "oauth_auth_popup");
    if (!popup) {
      const launchUrl = await resolveAuthorizationLaunchUrl();
      if (launchUrl) globalThis.window.location.assign(launchUrl);
      return;
    }

    popupRef.current = popup;
    const launchUrl = await resolveAuthorizationLaunchUrl();
    if (!launchUrl) {
      popup.close();
      return;
    }

    popup.location.href = launchUrl;
    popup.focus();
  };

  // Streamlined: when on Tokens step, auto exchange tokens once inputs are ready
  const autoExchangedRef = useRef(false);
  const autoAdvancedFromTokensRef = useRef(false);
  const handleExchangeTokensRef = useRef<() => Promise<void>>(async () => {});
  const handleDecodeTokensRef = useRef<() => void>(() => {});
  useEffect(() => {
    if (!streamlined) return;
    if (currentStep !== StepIndex.Tokens) return;
    if (accessToken && !autoAdvancedFromTokensRef.current) {
      autoAdvancedFromTokensRef.current = true;
      setCurrentStep(StepIndex.Decode);
      setMaxCompletedStep(
        (m) => Math.max(m as number, StepIndex.Decode as number) as StepIndex,
      );
      return;
    }
    if (autoExchangedRef.current) return;
    if (
      !exchanging &&
      authCode &&
      clientId &&
      redirectUri &&
      (!pkceEnabled || codeVerifier) &&
      tokenEndpoint &&
      providerConfigValid
    ) {
      autoExchangedRef.current = true;
      handleExchangeTokensRef.current().catch(() => undefined);
    }
  }, [
    streamlined,
    currentStep,
    exchanging,
    authCode,
    clientId,
    redirectUri,
    codeVerifier,
    tokenEndpoint,
    providerConfigValid,
    accessToken,
    pkceEnabled,
  ]);

  // Streamlined: when on Decode step, auto decode then advance to Validate
  const autoDecodedRef = useRef(false);
  const autoAdvancedFromDecodeRef = useRef(false);
  useEffect(() => {
    if (!streamlined) return;
    if (currentStep !== StepIndex.Decode) return;
    if (!autoDecodedRef.current) {
      autoDecodedRef.current = true;
      handleDecodeTokensRef.current();
    }
    const hasSomething = !!accessToken || !!idToken;
    if (hasSomething && !autoAdvancedFromDecodeRef.current) {
      autoAdvancedFromDecodeRef.current = true;
      const t = setTimeout(() => {
        setCurrentStep(StepIndex.Validate);
        setMaxCompletedStep(
          (m) =>
            Math.max(m as number, StepIndex.Validate as number) as StepIndex,
        );
      }, 50);
      return () => clearTimeout(t);
    }
  }, [streamlined, currentStep, accessToken, idToken]);

  // Generators for state/nonce and PKCE
  const handleGenerateState = () =>
    setAuthCodeConfidentialClientRuntime({
      stateParam: randomUrlSafeString(32),
    });
  const handleGenerateNonce = () =>
    setAuthCodeConfidentialClientRuntime({ nonce: randomUrlSafeString(32) });
  const handleGeneratePkce = async () => {
    const v = randomCodeVerifier();
    const ch = await computeS256Challenge(v);
    setAuthCodeConfidentialClientRuntime({
      codeVerifier: v,
      codeChallenge: ch,
    });
  };

  // Token request preview (x-www-form-urlencoded)
  const tokenRequestPreview = useMemo(() => {
    if (!clientId || !authCode || !redirectUri) return "";
    const params = new URLSearchParams();
    params.set("grant_type", "authorization_code");
    params.set("client_id", clientId);
    params.set("code", authCode);
    params.set("redirect_uri", redirectUri);
    if (pkceEnabled && codeVerifier) params.set("code_verifier", codeVerifier);
    if (isEntra && scopes.trim()) params.set("scope", scopes.trim());
    if (clientAuthMethod === "secret") {
      params.set("client_secret", clientSecret ? "<redacted>" : "");
    } else {
      params.set(
        "client_assertion_type",
        "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      );
      params.set(
        "client_assertion",
        privateKeyPem ? "<signed JWT (generated on send)>" : "",
      );
    }
    return params.toString();
  }, [
    clientId,
    authCode,
    redirectUri,
    pkceEnabled,
    codeVerifier,
    isEntra,
    scopes,
    clientAuthMethod,
    clientSecret,
    privateKeyPem,
  ]);

  async function handleExchangeTokens() {
    if (
      !authCode ||
      !clientId ||
      !redirectUri ||
      !tokenEndpoint ||
      !providerConfigValid
    )
      return;
    if (pkceEnabled && !codeVerifier) return;
    if (clientAuthMethod === "secret" && !clientSecret) return;
    if (clientAuthMethod === "certificate" && !privateKeyPem) return;
    setExchanging(true);
    setTokenResponseText("");
    setAuthCodeConfidentialClientRuntime({ accessToken: "", idToken: "" });
    setDecodedAccessHeader("");
    setDecodedAccessPayload("");
    setDecodedAccessFormat("invalid");
    setDecodedIdHeader("");
    setDecodedIdPayload("");
    setDecodedIdFormat("invalid");
    try {
      const res = await fetch(`/api/oauth/${providerId}/exchange-token`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          providerId,
          tenantId,
          issuerUrl,
          clientId,
          redirectUri,
          authCode,
          scopes,
          audience,
          pkceEnabled,
          codeVerifier,
          clientAuthMethod,
          clientSecret,
          privateKeyPem,
          clientAssertionKid,
          clientAssertionX5t,
          tokenEndpoint,
        }),
      });
      const contentType = res.headers.get("content-type") || "";
      const txt = contentType.includes("application/json")
        ? JSON.stringify(await res.json(), null, 2)
        : await res.text();
      setTokenResponseText(txt);
      try {
        const parsed = JSON.parse(txt);
        if (parsed && typeof parsed === "object" && parsed.access_token) {
          setAuthCodeConfidentialClientRuntime({
            accessToken: parsed.access_token as string,
          });
        }
        if (parsed && typeof parsed === "object" && parsed.id_token) {
          setAuthCodeConfidentialClientRuntime({
            idToken: parsed.id_token as string,
          });
        }
      } catch {}
    } catch (e: any) {
      setTokenResponseText(String(e));
    } finally {
      setExchanging(false);
    }
  }

  // Helpers to decode JWTs
  function handleDecodeTokens() {
    const acc = accessToken
      ? decodeJwt(accessToken)
      : { header: "", payload: "", format: "invalid" as const };
    const idt = idToken
      ? decodeJwt(idToken)
      : { header: "", payload: "", format: "invalid" as const };
    setDecodedAccessHeader(acc.header);
    setDecodedAccessPayload(acc.payload);
    setDecodedAccessFormat(acc.format);
    setDecodedIdHeader(idt.header);
    setDecodedIdPayload(idt.payload);
    setDecodedIdFormat(idt.format);
  }

  handleExchangeTokensRef.current = handleExchangeTokens;
  handleDecodeTokensRef.current = handleDecodeTokens;

  const handleCallProtectedApi = async () => {
    if (!apiEndpointUrl || !accessToken) return;
    setCallingApi(true);
    setApiResponseText("");
    try {
      const res = await fetch(apiEndpointUrl, {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const contentType = res.headers.get("content-type") || "";
      const txt = contentType.includes("application/json")
        ? JSON.stringify(await res.json(), null, 2)
        : await res.text();
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
    setResponseMode("");
    setPrompt("");
    setLoginHint("");
    setAuthorizationLaunchError("");
    setAuth0AuthorizationParameters({
      ...DEFAULT_AUTH0_AUTHORIZATION_PARAMETERS,
    });
    setTokenResponseText("");
    setDecodedAccessHeader("");
    setDecodedAccessPayload("");
    setDecodedAccessFormat("invalid");
    setDecodedIdHeader("");
    setDecodedIdPayload("");
    setDecodedIdFormat("invalid");
    setApiResponseText("");
    try {
      if (popupRef.current && !popupRef.current.closed)
        popupRef.current.close();
    } catch {}
    popupRef.current = null;
    try {
      autoExchangedRef.current = false;
      autoDecodedRef.current = false;
      (autoAdvancedFromTokensRef as any)?.current !== undefined &&
        ((autoAdvancedFromTokensRef as any).current = false);
      (autoAdvancedFromDecodeRef as any)?.current !== undefined &&
        ((autoAdvancedFromDecodeRef as any).current = false);
    } catch {}
  };

  // Start a new flow AND erase persisted settings for this flow (localStorage)
  const handleEraseAll = () => {
    // Reset persisted config to defaults (this writes to localStorage)
    setAuthCodeConfidentialClientConfig({
      providerId,
      tenantId: "",
      issuerUrl: "",
      clientId: "",
      redirectUri: "",
      scopes: getProviderDefaultScopes(providerId, "authCode"),
      audience: "",
      apiEndpointUrl: getProviderDefaultApiEndpoint(providerId, "authCode"),
      endpointOverrideEnabled: false,
      authEndpointOverride: "",
      tokenEndpointOverride: "",
      streamlined: false,
      pkceEnabled: true,
      clientAuthMethod: "secret",
      clientAssertionKid: "",
      clientAssertionX5t: "",
    });
    // Then do a normal flow reset
    handleResetFlow();
  };

  // Wizard validation per step
  const validators: Record<StepIndex, () => boolean> = {
    [StepIndex.Overview]: () => true,
    [StepIndex.Settings]: () =>
      clientIdValid &&
      redirectUriValid &&
      providerConfigValid &&
      !!resolvedAuthEndpoint &&
      !!resolvedTokenEndpoint,
    [StepIndex.Pkce]: () =>
      pkceEnabled ? !!codeVerifier && !!codeChallenge : true,
    [StepIndex.Authorize]: () =>
      callbackValidated ||
      (!!authCode && (!stateParam || stateParam === extractedState)),
    [StepIndex.Callback]: () =>
      callbackValidated ||
      maxCompletedStep >= StepIndex.Tokens ||
      (!!authCode && (!stateParam || stateParam === extractedState)),
    [StepIndex.Authentication]: () =>
      clientAuthMethod === "secret"
        ? clientSecret.trim().length > 0
        : privateKeyPem.trim().length > 0 && clientCertificateCredentialValid,
    [StepIndex.Tokens]: () => !!accessToken,
    [StepIndex.Decode]: () => {
      const hasAccessToken = !!accessToken;
      const hasIdToken = !!idToken;
      const accessDecoded =
        !hasAccessToken || decodedAccessFormat !== "invalid";
      const idDecoded = !hasIdToken || decodedIdFormat !== "invalid";

      if (!hasAccessToken && !hasIdToken) return false;
      return accessDecoded && idDecoded;
    },
    [StepIndex.Validate]: () => true,
    [StepIndex.CallApi]: () => false,
  };

  const canPrev = currentStep > StepIndex.Overview;
  const canNext =
    currentStep < StepIndex.CallApi && validators[currentStep]?.();

  const goPrev = () => {
    if (canPrev)
      setCurrentStep(
        (s) => Math.max(StepIndex.Overview, (s as number) - 1) as StepIndex,
      );
  };
  const goNext = () => {
    if (!canNext) return;
    // Streamlined: from Settings, auto-generate PKCE and skip the PKCE UI
    if (streamlined && currentStep === StepIndex.Settings) {
      if (pkceEnabled) handleGeneratePkce().catch(() => undefined);
      setCurrentStep(StepIndex.Authorize);
      setMaxCompletedStep(
        (m) =>
          Math.max(m as number, StepIndex.Authorize as number) as StepIndex,
      );
      return;
    }
    setCurrentStep((s) => {
      const next = Math.min(StepIndex.CallApi, (s as number) + 1) as StepIndex;
      setMaxCompletedStep(
        (m) => Math.max(m as number, next as number) as StepIndex,
      );
      return next;
    });
  };

  const stepLabels = [
    t("steps.overview"),
    t("steps.settings"),
    t("steps.pkce"),
    t("steps.authorize"),
    t("steps.callback"),
    t("steps.authentication"),
    t("steps.tokens"),
    t("steps.decode"),
    t("steps.validate"),
    t("steps.callApi"),
  ];
  const stepItems: MenuItem[] = stepLabels.map((label, idx) => ({
    label,
    disabled:
      idx > (maxCompletedStep as number) && idx > (currentStep as number),
    command: () => {
      if (idx <= (maxCompletedStep as number) || idx <= (currentStep as number))
        setCurrentStep(idx as StepIndex);
    },
  }));

  return (
    <>
      <div className="flex w-full align-items-center justify-content-between">
        <h4>{t("title")}</h4>
        <div className="flex align-items-center gap-2">
          <Button
            type="button"
            className="shadow-2"
            icon="pi pi-undo"
            onClick={handleResetFlow}
            aria-label={t("header.resetAria")}
            title={t("header.resetTitle")}
            style={{ transform: "scale(0.75)", transformOrigin: "center" }}
          />
          <Button
            type="button"
            className="shadow-2"
            icon="pi pi-eraser"
            severity="danger"
            onClick={handleEraseAll}
            aria-label={t("header.eraseAria")}
            title={t("header.eraseTitle")}
            style={{ transform: "scale(0.75)", transformOrigin: "center" }}
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
          flowIntro={t("overview.flowIntro")}
          flowDiagram={t("overview.flowDiagram")}
        />
      )}

      {currentStep === StepIndex.Settings && (
        <StepSettings
          providerId={providerId}
          tenantId={tenantId}
          setTenantId={(v: string) =>
            setAuthCodeConfidentialClientConfig({ tenantId: v })
          }
          issuerUrl={issuerUrl}
          setIssuerUrl={(v: string) =>
            setAuthCodeConfidentialClientConfig({ issuerUrl: v })
          }
          clientId={clientId}
          setClientId={(v: string) =>
            setAuthCodeConfidentialClientConfig({ clientId: v })
          }
          redirectUri={redirectUri}
          scopes={scopes}
          setScopes={(v: string) =>
            setAuthCodeConfidentialClientConfig({ scopes: v })
          }
          audience={audience}
          setAudience={(v: string) =>
            setAuthCodeConfidentialClientConfig({ audience: v })
          }
          streamlined={streamlined}
          setStreamlined={(v: boolean) =>
            setAuthCodeConfidentialClientConfig({ streamlined: v })
          }
          pkceEnabled={pkceEnabled}
          setPkceEnabled={(v: boolean) =>
            setAuthCodeConfidentialClientConfig({ pkceEnabled: v })
          }
          resolvedAuthEndpoint={resolvedAuthEndpoint}
          resolvedTokenEndpoint={resolvedTokenEndpoint}
          endpointOverrideEnabled={endpointOverrideEnabled}
          setEndpointOverrideEnabled={(v: boolean) =>
            setAuthCodeConfidentialClientConfig({ endpointOverrideEnabled: v })
          }
          authEndpointOverride={authEndpointOverride}
          setAuthEndpointOverride={(v: string) =>
            setAuthCodeConfidentialClientConfig({ authEndpointOverride: v })
          }
          tokenEndpointOverride={tokenEndpointOverride}
          setTokenEndpointOverride={(v: string) =>
            setAuthCodeConfidentialClientConfig({ tokenEndpointOverride: v })
          }
          providerConfigValid={providerConfigValid}
          tenantIdValid={tenantIdValid}
          issuerUrlValid={issuerUrlValid}
          clientIdValid={clientIdValid}
          redirectUriValid={redirectUriValid}
          discoveryLoading={providerMetadata.loading}
          discoveryError={providerMetadata.error}
          showAudience={providerId === "auth0"}
          t={tStepSettings}
          safeT={safeStepSettingsT}
        />
      )}

      {currentStep === StepIndex.Pkce &&
        (pkceEnabled ? (
          <StepPkce
            codeVerifier={codeVerifier}
            setCodeVerifier={(v) =>
              setAuthCodeConfidentialClientRuntime({ codeVerifier: v })
            }
            codeChallenge={codeChallenge}
            onGeneratePkce={handleGeneratePkce}
          />
        ) : (
          <section>
            <h3 className="mt-0 mb-3">{t("pkce.disabled.title")}</h3>
            <p className="mb-3">{t("pkce.disabled.description")}</p>
          </section>
        ))}

      {currentStep === StepIndex.Authorize && (
        <StepAuthorize
          responseType={responseType}
          stateParam={stateParam}
          setStateParam={(v) =>
            setAuthCodeConfidentialClientRuntime({ stateParam: v })
          }
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
          authorizationLaunchError={authorizationLaunchError}
          launchDisabled={rarInvalid}
          showResponseMode={isEntra}
          includeSelectAccountPrompt={isEntra}
          advancedAuthorizationOptions={
            !isEntra ? (
              <Auth0AuthorizationRequestOptions
                authRequestMode={authRequestMode}
                setAuthRequestMode={(value) =>
                  setAuthCodeConfidentialClientConfig({
                    authRequestMode: value,
                  })
                }
                parameters={auth0AuthorizationParameters}
                setParameter={setAuth0AuthorizationParameter}
                rarJson={rarJson}
                setRarJson={(value) =>
                  setAuthCodeConfidentialClientConfig({ rarJson: value })
                }
                rarError={rarError}
                supportedModes={["url", "par", "jar", "par-jar"]}
                clientAuthMethod={clientAuthMethod}
                requestObjectKeyPem={privateKeyPem}
                setRequestObjectKeyPem={(value) =>
                  setAuthCodeConfidentialClientRuntime({ privateKeyPem: value })
                }
                requestObjectKid={clientAssertionKid}
                setRequestObjectKid={(value) =>
                  setAuthCodeConfidentialClientConfig({
                    clientAssertionKid: value,
                  })
                }
              />
            ) : undefined
          }
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
          providerId={providerId}
          clientAuthMethod={clientAuthMethod}
          setClientAuthMethod={(v: "secret" | "certificate") =>
            setAuthCodeConfidentialClientConfig({ clientAuthMethod: v })
          }
          clientSecret={clientSecret}
          setClientSecret={(v: string) =>
            setAuthCodeConfidentialClientRuntime({ clientSecret: v })
          }
          privateKeyPem={privateKeyPem}
          setPrivateKeyPem={(v: string) =>
            setAuthCodeConfidentialClientRuntime({ privateKeyPem: v })
          }
          certificatePem={certificatePem}
          setCertificatePem={(v: string) =>
            setAuthCodeConfidentialClientRuntime({ certificatePem: v })
          }
          clientAssertionKid={clientAssertionKid}
          setClientAssertionKid={(v: string) =>
            setAuthCodeConfidentialClientConfig({ clientAssertionKid: v })
          }
          setClientAssertionX5t={(v: string) =>
            setAuthCodeConfidentialClientConfig({ clientAssertionX5t: v })
          }
          publicKeyPem={publicKeyPem}
          setPublicKeyPem={(v: string) =>
            setAuthCodeConfidentialClientRuntime({ publicKeyPem: v })
          }
          thumbprintSha1={thumbprintSha1}
          setThumbprintSha1={(v: string) =>
            setAuthCodeConfidentialClientRuntime({ thumbprintSha1: v })
          }
          setThumbprintSha256={(v: string) =>
            setAuthCodeConfidentialClientRuntime({ thumbprintSha256: v })
          }
          thumbprintSha1Base64Url={thumbprintSha1Base64Url}
          setThumbprintSha1Base64Url={(v: string) =>
            setAuthCodeConfidentialClientRuntime({ thumbprintSha1Base64Url: v })
          }
          assertionClaims={assertionClaims}
          setAssertionClaims={(v: string) =>
            setAuthCodeConfidentialClientRuntime({ assertionClaims: v })
          }
          testAssertion={testAssertion}
          setTestAssertion={(v: string) =>
            setAuthCodeConfidentialClientRuntime({ testAssertion: v })
          }
          decodedAssertion={decodedAssertion}
          setDecodedAssertion={(v: string) =>
            setAuthCodeConfidentialClientRuntime({ decodedAssertion: v })
          }
          clientId={clientId}
          assertionAudience={assertionAudience}
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
          decodedAccessFormat={decodedAccessFormat}
          decodedIdHeader={decodedIdHeader}
          decodedIdPayload={decodedIdPayload}
          decodedIdFormat={decodedIdFormat}
          providerId={providerId}
          onDecodeTokens={handleDecodeTokens}
        />
      )}

      {currentStep === StepIndex.Validate && (
        <StepValidate
          providerId={providerId}
          tenantId={tenantId}
          issuerUrl={issuerUrl}
          clientId={clientId}
          expectedAudience={audience.trim() || undefined}
          expectedNonce={nonce}
          isClientCredentials={false}
          decodedAccessHeader={decodedAccessHeader}
          decodedAccessPayload={decodedAccessPayload}
          decodedAccessFormat={decodedAccessFormat}
          decodedIdHeader={decodedIdHeader}
          decodedIdPayload={decodedIdPayload}
          decodedIdFormat={decodedIdFormat}
          accessToken={accessToken}
          idToken={idToken}
        />
      )}

      {currentStep === StepIndex.CallApi && (
        <StepCallApi
          apiEndpointUrl={apiEndpointUrl}
          setApiEndpointUrl={(v: string) =>
            setAuthCodeConfidentialClientConfig({ apiEndpointUrl: v })
          }
          accessToken={accessToken}
          apiResponseText={apiResponseText}
          callingApi={callingApi}
          onCallApi={handleCallProtectedApi}
        />
      )}

      {/* Wizard navigation */}
      <div className="flex justify-content-between align-items-center mt-4">
        <Button
          type="button"
          label={t("buttons.previous")}
          icon="pi pi-arrow-left"
          onClick={goPrev}
          disabled={!canPrev}
          className="p-button-secondary"
        />
        <Button
          type="button"
          label={t("buttons.next")}
          iconPos="right"
          icon="pi pi-arrow-right"
          onClick={goNext}
          disabled={!canNext}
        />
      </div>
    </>
  );
}
