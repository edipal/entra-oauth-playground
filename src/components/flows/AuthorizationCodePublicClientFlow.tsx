"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Steps } from "primereact/steps";
import type { MenuItem } from "primereact/menuitem";
import { Button } from "primereact/button";
import StepOverview from "@/components/steps/StepOverview";
import StepSettings from "@/components/steps/StepSettings";
import StepPkce from "@/components/steps/StepPkce";
import StepAuthorize from "@/components/steps/StepAuthorize";
import StepCallback from "@/components/steps/StepCallback";
import StepTokens from "@/components/steps/StepTokens";
import StepDecode from "@/components/steps/StepDecode";
import StepCallApi from "@/components/steps/StepCallApi";
import StepValidate from "@/components/steps/StepValidate";
import Auth0AuthorizationRequestOptions from "@/components/steps/auth0/StepAuthorizationRequestOptions";
import { randomCodeVerifier, computeS256Challenge } from "@/lib/pkce";
import { randomUrlSafeString } from "@/lib/random";
import { decodeJwt, type DecodedTokenFormat } from "@/lib/jwtDecode";
import {
  findTokenExchangeBlocker,
  type TokenExchangeBlocker,
} from "@/lib/tokenExchangeReadiness";
import { TranslationUtils } from "@/lib/translation";
import { useSettings } from "@/components/SettingsContext";
import { useProviderMetadata } from "@/hooks/useProviderMetadata";
import {
  DEFAULT_PROVIDER_ID,
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
import {
  generateDPoPKeyPair,
  exportDPoPPublicJWK,
  calculateDPoPThumbprint,
  calculateAccessTokenHash,
  createDPoPProof,
} from "@/lib/dpop";

enum StepIndex {
  Overview = 0,
  Settings = 1,
  Pkce = 2,
  Authorize = 3,
  Callback = 4,
  Tokens = 5,
  Decode = 6,
  Validate = 7,
  CallApi = 8,
}

export default function AuthorizationCodePublicClientPage() {
  const tMain = useTranslations("AuthorizationCode.PublicClient.Main");
  const tStepSettings = useTranslations("StepSettings");
  const tAuth0Options = useTranslations("Auth0AuthorizationOptions");

  // Helper to return literal strings for StepSettings even if they contain {tenant}
  const safeStepSettingsT = (key: string): string =>
    TranslationUtils.safeT(tStepSettings, key);

  // Settings persisted/global via SettingsContext
  const {
    authCodePublicClientConfig,
    setAuthCodePublicClientConfig,
    authCodePublicClientRuntime,
    setAuthCodePublicClientRuntime,
    resetAuthCodePublicClientRuntime,
    resetAuthCodePublicClientConfig,
    hydrated,
  } = useSettings();
  const providerId =
    authCodePublicClientConfig.providerId || DEFAULT_PROVIDER_ID;
  const issuerUrl = authCodePublicClientConfig.issuerUrl || "";
  const audience = authCodePublicClientConfig.audience || "";
  const endpointOverrideEnabled =
    !!authCodePublicClientConfig.endpointOverrideEnabled;
  const authEndpointOverride =
    authCodePublicClientConfig.authEndpointOverride || "";
  const tokenEndpointOverride =
    authCodePublicClientConfig.tokenEndpointOverride || "";
  const providerMetadata = useProviderMetadata(providerId, issuerUrl);
  const streamlined = !!authCodePublicClientConfig.streamlined;
  const pkceEnabled = !!authCodePublicClientConfig.pkceEnabled;
  const authRequestMode = authCodePublicClientConfig.authRequestMode || "url";
  const rarJson = authCodePublicClientConfig.rarJson || "";
  const dpopEnabled = !!authCodePublicClientConfig.dpopEnabled;

  // Wizard state (start at Settings by default; Overview still accessible via steps navigation)
  const [currentStep, setCurrentStep] = useState<StepIndex>(
    () => StepIndex.Settings,
  );
  const [maxCompletedStep, setMaxCompletedStep] = useState<StepIndex>(
    StepIndex.Overview,
  );
  const tenantId = authCodePublicClientConfig.tenantId!;
  const clientId = authCodePublicClientConfig.clientId!;
  const redirectUri = authCodePublicClientConfig.redirectUri!;
  const scopes = authCodePublicClientConfig.scopes!;
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

  // DPoP runtime
  const dpopJkt = authCodePublicClientRuntime.dpopJkt || "";
  const dpopPublicJwk = authCodePublicClientRuntime.dpopPublicJwk;
  const dpopKeyPair = authCodePublicClientRuntime.dpopKeyPair;

  const handleGenerateDpopKey = useCallback(async () => {
    try {
      const keyPair = await generateDPoPKeyPair();
      const publicJwk = await exportDPoPPublicJWK(keyPair.publicKey);
      const jkt = await calculateDPoPThumbprint(publicJwk);
      setAuthCodePublicClientRuntime({
        dpopKeyPair: keyPair,
        dpopPublicJwk: publicJwk,
        dpopJkt: jkt,
      });
    } catch (err) {
      console.error("Failed to generate DPoP key pair", err);
    }
  }, [setAuthCodePublicClientRuntime]);

  useEffect(() => {
    if (dpopEnabled && !authCodePublicClientRuntime.dpopKeyPair) {
      handleGenerateDpopKey();
    }
  }, [
    dpopEnabled,
    authCodePublicClientRuntime.dpopKeyPair,
    handleGenerateDpopKey,
  ]);

  // PKCE fields (global runtime via context)
  const codeVerifier = authCodePublicClientRuntime.codeVerifier!;
  const codeChallenge = authCodePublicClientRuntime.codeChallenge!;

  // Additional params
  const [responseType] = useState("code");
  const stateParam = authCodePublicClientRuntime.stateParam!;
  const nonce = authCodePublicClientRuntime.nonce!;
  const [responseMode, setResponseMode] = useState("");
  const [prompt, setPrompt] = useState("");
  const [loginHint, setLoginHint] = useState("");
  const [authorizationLaunchError, setAuthorizationLaunchError] = useState("");
  const [auth0AuthorizationParameters, setAuth0AuthorizationParameters] =
    useState<Auth0AuthorizationParameters>({
      ...DEFAULT_AUTH0_AUTHORIZATION_PARAMETERS,
    });

  // Callback handling
  const callbackUrl = authCodePublicClientRuntime.callbackUrl!;
  const callbackBody = authCodePublicClientRuntime.callbackBody!;
  const authCode = authCodePublicClientRuntime.authCode!;
  const extractedState = authCodePublicClientRuntime.extractedState!;
  const callbackValidated = !!authCodePublicClientRuntime.callbackValidated;

  // Token exchange
  const [exchanging, setExchanging] = useState(false);
  const [exchangeBlockedReason, setExchangeBlockedReason] =
    useState<TokenExchangeBlocker | null>(null);
  const [tokenResponseText, setTokenResponseText] = useState("");
  const [dpopNonceRetried, setDpopNonceRetried] = useState(false);
  const accessToken = authCodePublicClientRuntime.accessToken!;
  const idToken = authCodePublicClientRuntime.idToken!;

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
  const apiEndpointUrl = authCodePublicClientConfig.apiEndpointUrl!;
  const [apiResponseText, setApiResponseText] = useState("");
  const [callingApi, setCallingApi] = useState(false);

  // Popup window ref
  const popupRef = useRef<Window | null>(null);
  // Scroll-to-top anchor
  const topRef = useRef<HTMLDivElement | null>(null);

  // Initialize redirectUri from current origin so it works in dev and prod
  useEffect(() => {
    if (globalThis.window !== undefined && hydrated) {
      const uri = `${globalThis.window.location.origin}/callback/auth-code`;
      if (!redirectUri) {
        setAuthCodePublicClientConfig((prev) => ({
          ...prev,
          redirectUri: uri,
        }));
      }
    }
  }, [redirectUri, setAuthCodePublicClientConfig, hydrated]);

  useEffect(() => {
    if (isEntraProvider(providerId)) return;
    if (!providerMetadata.metadata?.userinfo_endpoint) return;
    if (apiEndpointUrl) return;

    setAuthCodePublicClientConfig({
      apiEndpointUrl: providerMetadata.metadata.userinfo_endpoint,
    });
  }, [
    apiEndpointUrl,
    providerId,
    providerMetadata.metadata?.userinfo_endpoint,
    setAuthCodePublicClientConfig,
  ]);

  // Validation helpers (Settings step) — hoisted before use
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

  const setAuth0AuthorizationParameter = useCallback(
    (name: keyof Auth0AuthorizationParameters, value: string) => {
      setAuth0AuthorizationParameters((prev) => ({ ...prev, [name]: value }));
    },
    [],
  );

  // Rich Authorization Requests JSON is user-authored, so it is validated before it
  // can reach the authorization URL or a pushed authorization request.
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

  // Build the authorize URL preview from inputs
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
      if (dpopEnabled && dpopJkt) {
        url.searchParams.set("dpop_jkt", dpopJkt);
      }
    }
    // domain_hint and claims intentionally omitted here per request
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
    dpopEnabled,
    dpopJkt,
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

      // Mark callback as validated if state matches (or no state was set)
      const ok = !!code && (!stateParam || stateParam === st);
      // A new authorization response makes everything downstream stale. Without
      // this the second round trip walks forward showing the first run's tokens
      // and its decoded claims, which look like the new ones — and in streamlined
      // mode the auto-exchange refs below never fire again, so the new code is
      // never redeemed at all.
      setAuthCodePublicClientRuntime({
        callbackUrl: urlStr,
        callbackBody: bodyStr,
        authCode: code,
        extractedState: st,
        // Each callback stands on its own state comparison — see the confidential
        // flow for why the previous `prev.callbackValidated || ok` latch meant a
        // later state mismatch advanced the wizard just as a match would.
        callbackValidated: ok,
        accessToken: "",
        idToken: "",
      });
      setTokenResponseText("");
      setDecodedAccessHeader("");
      setDecodedAccessPayload("");
      setDecodedAccessFormat("invalid");
      setDecodedIdHeader("");
      setDecodedIdPayload("");
      setDecodedIdFormat("invalid");
      setApiResponseText("");
      autoExchangedRef.current = false;
      autoDecodedRef.current = false;
      autoAdvancedFromTokensRef.current = false;
      autoAdvancedFromDecodeRef.current = false;

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
    };

    const onMessage = (ev: MessageEvent) => {
      const data = ev.data;
      // Basic origin check: only accept messages from same origin
      if (ev.origin !== globalThis.window?.location.origin) return;
      if (data?.type !== "oauth_callback") return;

      try {
        handleOAuthCallback(data);
      } catch {
        // ignore parse errors
      }

      try {
        if (popupRef.current && !popupRef.current.closed) {
          popupRef.current.close();
        }
      } catch {
        // ignore
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [stateParam, setAuthCodePublicClientRuntime, streamlined]);

  // Streamlined: when on Tokens step, auto exchange tokens once inputs are ready
  const autoExchangedRef = useRef(false);
  const autoAdvancedFromTokensRef = useRef(false);
  const handleExchangeTokensRef = useRef<() => Promise<void>>(async () => {});
  const handleDecodeTokensRef = useRef<() => void>(() => {});
  useEffect(() => {
    if (!streamlined) return;
    if (currentStep !== StepIndex.Tokens) return;
    // If already have tokens, advance to Decode
    if (accessToken && !autoAdvancedFromTokensRef.current) {
      autoAdvancedFromTokensRef.current = true;
      setCurrentStep(StepIndex.Decode);
      setMaxCompletedStep(
        (m) => Math.max(m as number, StepIndex.Decode as number) as StepIndex,
      );
      return;
    }
    if (autoExchangedRef.current) return;
    // Trigger exchange if we have enough data
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
    // After a brief tick, move to Validate if we have some decoded content or tokens
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

  /**
   * Public clients always send the authorization request on the URL. Auth0
   * supports PAR for confidential clients only, and a public client has no
   * credential to authenticate the push with, so the mode is not offered here.
   */
  const resolveAuthorizationLaunchUrl = async () => {
    setAuthorizationLaunchError("");

    if (rarInvalid) {
      setAuthorizationLaunchError(rarError);
      return "";
    }

    return authUrlPreview;
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

  // Generators for state/nonce centralised in random utilities
  const handleGenerateState = () =>
    setAuthCodePublicClientRuntime({ stateParam: randomUrlSafeString(32) });
  const handleGenerateNonce = () =>
    setAuthCodePublicClientRuntime({ nonce: randomUrlSafeString(32) });

  // (Validation helpers already hoisted above)

  // Helpers: PKCE generation
  const handleGeneratePkce = async () => {
    const v = randomCodeVerifier();
    const ch = await computeS256Challenge(v);
    setAuthCodePublicClientRuntime({ codeVerifier: v, codeChallenge: ch });
  };

  // Compute token request preview (x-www-form-urlencoded)
  const tokenRequestPreview = useMemo(() => {
    if (
      !clientId ||
      !authCode ||
      !redirectUri ||
      (pkceEnabled && !codeVerifier)
    )
      return "";
    const params = new URLSearchParams();
    params.set("grant_type", "authorization_code");
    params.set("client_id", clientId);
    params.set("code", authCode);
    params.set("redirect_uri", redirectUri);
    if (pkceEnabled) params.set("code_verifier", codeVerifier);
    if (isEntra && scopes.trim()) params.set("scope", scopes.trim());
    return params.toString();
  }, [
    authCode,
    clientId,
    codeVerifier,
    isEntra,
    redirectUri,
    scopes,
    pkceEnabled,
  ]);

  async function handleExchangeTokens() {
    // Say which precondition is unmet rather than returning silently while the
    // Send button stays enabled — see findTokenExchangeBlocker.
    const blocker = findTokenExchangeBlocker({
      providerConfigValid,
      clientId,
      redirectUri,
      tokenEndpoint,
      authCode,
      pkceEnabled,
      codeVerifier,
    });
    setExchangeBlockedReason(blocker);
    if (blocker) return;

    setExchanging(true);
    setTokenResponseText("");
    setDpopNonceRetried(false);
    setAuthCodePublicClientRuntime({ accessToken: "", idToken: "" });
    setDecodedAccessHeader("");
    setDecodedAccessPayload("");
    setDecodedAccessFormat("invalid");
    setDecodedIdHeader("");
    setDecodedIdPayload("");
    setDecodedIdFormat("invalid");
    try {
      const body = new URLSearchParams();
      body.set("grant_type", "authorization_code");
      body.set("client_id", clientId);
      body.set("code", authCode);
      body.set("redirect_uri", redirectUri);
      if (pkceEnabled) body.set("code_verifier", codeVerifier);
      if (isEntra && scopes.trim()) body.set("scope", scopes.trim());

      const headers: Record<string, string> = {
        "content-type": "application/x-www-form-urlencoded",
      };

      if (!isEntra && dpopEnabled && dpopKeyPair && dpopPublicJwk) {
        const proof = await createDPoPProof({
          privateKey: dpopKeyPair.privateKey,
          jwk: dpopPublicJwk,
          htm: "POST",
          htu: tokenEndpoint,
          nonce: authCodePublicClientRuntime.serverDPoPNonce || undefined,
        });
        headers["DPoP"] = proof;
        setAuthCodePublicClientRuntime({ lastTokenDPoPProof: proof });
      }

      let res = await fetch(tokenEndpoint, {
        method: "POST",
        headers,
        body: body.toString(),
      });
      const responseNonce = res.headers.get("dpop-nonce");
      if (responseNonce) {
        setAuthCodePublicClientRuntime({ serverDPoPNonce: responseNonce });
      }
      let contentType = res.headers.get("content-type") || "";
      let txt = contentType.includes("application/json")
        ? JSON.stringify(await res.json(), null, 2)
        : await res.text();

      if (
        !isEntra &&
        dpopEnabled &&
        dpopKeyPair &&
        dpopPublicJwk &&
        res.status === 400 &&
        responseNonce &&
        txt.includes("use_dpop_nonce")
      ) {
        setDpopNonceRetried(true);
        const retryProof = await createDPoPProof({
          privateKey: dpopKeyPair.privateKey,
          jwk: dpopPublicJwk,
          htm: "POST",
          htu: tokenEndpoint,
          nonce: responseNonce,
        });
        headers["DPoP"] = retryProof;
        setAuthCodePublicClientRuntime({
          lastTokenDPoPProof: retryProof,
          serverDPoPNonce: responseNonce,
        });

        res = await fetch(tokenEndpoint, {
          method: "POST",
          headers,
          body: body.toString(),
        });
        const retryResponseNonce = res.headers.get("dpop-nonce");
        if (retryResponseNonce) {
          setAuthCodePublicClientRuntime({
            serverDPoPNonce: retryResponseNonce,
          });
        }
        contentType = res.headers.get("content-type") || "";
        txt = contentType.includes("application/json")
          ? JSON.stringify(await res.json(), null, 2)
          : await res.text();
      }

      setTokenResponseText(txt);
      try {
        const parsed = JSON.parse(txt);
        if (parsed && typeof parsed === "object" && parsed.access_token) {
          setAuthCodePublicClientRuntime({
            accessToken: parsed.access_token as string,
          });
        }
        if (parsed && typeof parsed === "object" && parsed.id_token) {
          setAuthCodePublicClientRuntime({
            idToken: parsed.id_token as string,
          });
        }
      } catch {
        // non-JSON response
      }
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
      const isDPoP =
        !isEntra && dpopEnabled && !!dpopKeyPair && !!dpopPublicJwk;
      let currentNonce = authCodePublicClientRuntime.serverDPoPNonce;
      const headers: Record<string, string> = {};

      if (isDPoP) {
        const ath = await calculateAccessTokenHash(accessToken);
        const proof = await createDPoPProof({
          privateKey: dpopKeyPair.privateKey,
          jwk: dpopPublicJwk,
          htm: "GET",
          htu: apiEndpointUrl,
          ath,
          nonce: currentNonce,
        });
        headers["Authorization"] = `DPoP ${accessToken}`;
        headers["DPoP"] = proof;
        setAuthCodePublicClientRuntime({ lastApiDPoPProof: proof });
      } else {
        headers["Authorization"] = `Bearer ${accessToken}`;
      }

      let res = await fetch(apiEndpointUrl, {
        method: "GET",
        headers,
      });

      const respNonce = res.headers.get("dpop-nonce");
      if (respNonce && respNonce !== currentNonce) {
        setAuthCodePublicClientRuntime({ serverDPoPNonce: respNonce });
        currentNonce = respNonce;
      }

      if (isDPoP && res.status === 401 && respNonce) {
        const ath = await calculateAccessTokenHash(accessToken);
        const retryProof = await createDPoPProof({
          privateKey: dpopKeyPair.privateKey,
          jwk: dpopPublicJwk,
          htm: "GET",
          htu: apiEndpointUrl,
          ath,
          nonce: respNonce,
        });
        headers["DPoP"] = retryProof;
        setAuthCodePublicClientRuntime({ lastApiDPoPProof: retryProof });
        res = await fetch(apiEndpointUrl, {
          method: "GET",
          headers,
        });
      }

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
    resetAuthCodePublicClientRuntime();
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
    setExchangeBlockedReason(null);
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
    // Reset streamlined automation flags
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
    // Replaces the persisted config with the provider defaults, so a field added
    // later cannot survive the erase — see the confidential flow for the two that
    // did.
    resetAuthCodePublicClientConfig();
    // Then do a normal flow reset
    handleResetFlow();
  };

  // Wizard validation per step
  // validators indexed by StepIndex
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
    if (!canPrev) return;
    setCurrentStep(
      (s) => Math.max(StepIndex.Overview, (s as number) - 1) as StepIndex,
    );
  };
  const goNext = () => {
    if (!canNext) return;
    // Special streamlined behavior: from Settings, auto-generate PKCE and skip the PKCE UI
    if (streamlined && currentStep === StepIndex.Settings) {
      // Generate PKCE (async) and jump to Authorize
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
    tMain("steps.overview"),
    tMain("steps.settings"),
    tMain("steps.pkce"),
    tMain("steps.authorize"),
    tMain("steps.callback"),
    tMain("steps.tokens"),
    tMain("steps.decode"),
    tMain("steps.validate"),
    tMain("steps.callApi"),
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

  // When step changes, scroll to top of the scrollable container
  useEffect(() => {
    try {
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      // Fallback for environments where scrollIntoView doesn't affect the intended container
      if (globalThis.window !== undefined)
        globalThis.window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {}
  }, [currentStep]);
  return (
    <>
      <div ref={topRef} />

      <div className="flex w-full align-items-center justify-content-between mt-40">
        <h4>{tMain("title")}</h4>
        <div className="flex align-items-center gap-2">
          <Button
            type="button"
            className="shadow-2"
            icon="pi pi-undo"
            onClick={handleResetFlow}
            aria-label={tMain("header.resetAria")}
            title={tMain("header.resetTitle")}
            style={{ transform: "scale(0.75)", transformOrigin: "center" }}
          />
          <Button
            type="button"
            className="shadow-2"
            icon="pi pi-eraser"
            severity="danger"
            onClick={handleEraseAll}
            aria-label={tMain("header.eraseAria")}
            title={tMain("header.eraseTitle")}
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
          flowIntro={tMain("overview.flowIntro")}
          flowDiagram={tMain("overview.flowDiagram")}
        />
      )}

      {currentStep === StepIndex.Settings && (
        <StepSettings
          providerId={providerId}
          tenantId={tenantId}
          setTenantId={(v) => setAuthCodePublicClientConfig({ tenantId: v })}
          issuerUrl={issuerUrl}
          setIssuerUrl={(v) => setAuthCodePublicClientConfig({ issuerUrl: v })}
          clientId={clientId}
          setClientId={(v) => setAuthCodePublicClientConfig({ clientId: v })}
          redirectUri={redirectUri}
          scopes={scopes}
          setScopes={(v) => setAuthCodePublicClientConfig({ scopes: v })}
          audience={audience}
          setAudience={(v) => setAuthCodePublicClientConfig({ audience: v })}
          streamlined={streamlined}
          setStreamlined={(v) =>
            setAuthCodePublicClientConfig({ streamlined: v })
          }
          pkceEnabled={pkceEnabled}
          setPkceEnabled={(v) =>
            setAuthCodePublicClientConfig({ pkceEnabled: v })
          }
          resolvedAuthEndpoint={resolvedAuthEndpoint}
          resolvedTokenEndpoint={resolvedTokenEndpoint}
          endpointOverrideEnabled={endpointOverrideEnabled}
          setEndpointOverrideEnabled={(v) =>
            setAuthCodePublicClientConfig({ endpointOverrideEnabled: v })
          }
          authEndpointOverride={authEndpointOverride}
          setAuthEndpointOverride={(v) =>
            setAuthCodePublicClientConfig({ authEndpointOverride: v })
          }
          tokenEndpointOverride={tokenEndpointOverride}
          setTokenEndpointOverride={(v) =>
            setAuthCodePublicClientConfig({ tokenEndpointOverride: v })
          }
          providerConfigValid={providerConfigValid}
          tenantIdValid={tenantIdValid}
          issuerUrlValid={issuerUrlValid}
          clientIdValid={clientIdValid}
          redirectUriValid={redirectUriValid}
          discoveryLoading={providerMetadata.loading}
          discoveryError={providerMetadata.error}
          showAudience={providerId === "auth0"}
          dpopEnabled={dpopEnabled}
          setDpopEnabled={(v) =>
            setAuthCodePublicClientConfig({ dpopEnabled: v })
          }
          dpopJkt={dpopJkt}
          dpopPublicJwk={dpopPublicJwk}
          onRegenerateDpopKey={handleGenerateDpopKey}
          safeT={safeStepSettingsT}
          t={tStepSettings}
        />
      )}

      {currentStep === StepIndex.Pkce &&
        (pkceEnabled ? (
          <StepPkce
            codeVerifier={codeVerifier}
            setCodeVerifier={(v) =>
              setAuthCodePublicClientRuntime({ codeVerifier: v })
            }
            codeChallenge={codeChallenge}
            onGeneratePkce={handleGeneratePkce}
          />
        ) : (
          <section>
            <h3 className="mt-0 mb-3">
              {TranslationUtils.maybeT(
                tMain,
                "pkce.disabled.title",
                "PKCE is disabled",
              )}
            </h3>
            <p className="mb-3">
              {TranslationUtils.maybeT(
                tMain,
                "pkce.disabled.description",
                "Enable PKCE in settings to generate a code verifier and challenge.",
              )}
            </p>
          </section>
        ))}

      {currentStep === StepIndex.Authorize && (
        <StepAuthorize
          responseType={responseType}
          stateParam={stateParam}
          setStateParam={(v) =>
            setAuthCodePublicClientRuntime({ stateParam: v })
          }
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
          authorizationLaunchError={authorizationLaunchError}
          launchDisabled={rarInvalid}
          showResponseMode={isEntra}
          includeSelectAccountPrompt={isEntra}
          advancedAuthorizationOptions={
            !isEntra ? (
              <Auth0AuthorizationRequestOptions
                authRequestMode={authRequestMode}
                setAuthRequestMode={(value) =>
                  setAuthCodePublicClientConfig({ authRequestMode: value })
                }
                parameters={auth0AuthorizationParameters}
                setParameter={setAuth0AuthorizationParameter}
                rarJson={rarJson}
                setRarJson={(value) =>
                  setAuthCodePublicClientConfig({ rarJson: value })
                }
                rarError={rarError}
                supportedModes={["url"]}
                dpopJkt={dpopEnabled ? dpopJkt : undefined}
              />
            ) : undefined
          }
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
          blockedReason={exchangeBlockedReason}
          dpopEnabled={!isEntra && dpopEnabled}
          dpopProof={authCodePublicClientRuntime.lastTokenDPoPProof}
          dpopNonceRetried={dpopNonceRetried}
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
          dpopEnabled={dpopEnabled}
          dpopJkt={dpopJkt}
          tokenResponseText={tokenResponseText}
        />
      )}

      {currentStep === StepIndex.CallApi && (
        <StepCallApi
          apiEndpointUrl={apiEndpointUrl}
          setApiEndpointUrl={(v: string) =>
            setAuthCodePublicClientConfig({ apiEndpointUrl: v })
          }
          accessToken={accessToken}
          apiResponseText={apiResponseText}
          callingApi={callingApi}
          onCallApi={handleCallProtectedApi}
          dpopEnabled={!isEntra && dpopEnabled}
          dpopProof={authCodePublicClientRuntime.lastApiDPoPProof}
        />
      )}

      {/* Wizard navigation */}
      <div className="flex justify-content-between align-items-center mt-4">
        <Button
          type="button"
          label={tMain("buttons.previous")}
          icon="pi pi-arrow-left"
          onClick={goPrev}
          disabled={!canPrev}
          className="p-button-secondary"
        />
        <Button
          type="button"
          label={tMain("buttons.next")}
          iconPos="right"
          icon="pi pi-arrow-right"
          onClick={goNext}
          disabled={!canNext}
        />
      </div>
    </>
  );
}
