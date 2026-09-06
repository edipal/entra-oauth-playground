"use client";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  buildMetadataUrl,
  guessJwksUrl,
  verifyJwtSignature,
} from "@/lib/jwtVerify";
import type { DecodedTokenFormat } from "@/lib/jwtDecode";
import type { IdentityProviderId } from "@/lib/identityProvider";
import {
  DEFAULT_PROVIDER_ID,
  getIssuerForValidation,
  isEntraProvider,
  issuerMatchesExpected,
} from "@/lib/identityProvider";

type Props = {
  providerId?: IdentityProviderId;
  tenantId: string;
  issuerUrl?: string;
  clientId: string;
  expectedAudience?: string;
  expectedNonce: string;
  isClientCredentials: boolean;
  decodedAccessHeader: string;
  decodedAccessPayload: string;
  decodedIdHeader: string;
  decodedIdPayload: string;
  decodedAccessFormat?: DecodedTokenFormat;
  decodedIdFormat?: DecodedTokenFormat;
  accessToken?: string;
  idToken?: string;
  dpopEnabled?: boolean;
  dpopJkt?: string;
  tokenResponseText?: string;
  tokenType?: string;
};

type JwtHeader = {
  alg?: string;
  kid?: string;
  typ?: string;
  [key: string]: unknown;
};

type JwtPayload = {
  iss?: string;
  aud?: string | string[];
  tid?: string;
  /** Entra's token version. Auth0 issues no such claim. */
  ver?: string;
  /** Entra's delegated scopes. Auth0 uses `scope`. */
  scp?: string;
  scope?: string;
  roles?: string[];
  wids?: string[];
  nonce?: string;
  exp?: number;
  nbf?: number;
  iat?: number;
  cnf?: {
    jkt?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
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

const parseJson = <T,>(value: string): T | undefined => {
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object") return parsed as T;
  } catch {}
  return undefined;
};

const fmtEpoch = (value?: number) => {
  if (!value && value !== 0) return "";
  try {
    return `${new Date(value * 1000).toLocaleString()} (${value})`;
  } catch {
    return String(value);
  }
};

const ensureArray = (value: string | string[] | undefined): string[] => {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") return [value];
  return [];
};

const renderCode = (chunks: ReactNode) => <code>{chunks}</code>;

function StatusIcon({
  ok,
  label,
}: Readonly<{ ok: boolean | undefined; label?: string }>) {
  return (
    <span style={{ color: ok ? "#16a34a" : "#dc2626", fontWeight: 600 }}>
      <i
        className={`pi ${ok ? "pi-check" : "pi-times"}`}
        style={{ marginRight: 6 }}
      />
      {label}
    </span>
  );
}

const isMicrosoftIssuerHost = (issuer?: string) => {
  if (!issuer) return false;
  try {
    const host = new URL(issuer).host.toLowerCase();
    return host === "login.microsoftonline.com" || host === "sts.windows.net";
  } catch {
    return false;
  }
};

const getIssuerExpectationLabel = (
  expectedIssuer: string | null,
  providerId: IdentityProviderId,
): string => {
  if (!expectedIssuer) return "";
  return providerId === "entra"
    ? `(tenant ${expectedIssuer})`
    : `(issuer ${expectedIssuer})`;
};

async function resolveJwksCandidates(
  issuer: string,
  tenantId?: string,
  providerId?: IdentityProviderId,
): Promise<string[]> {
  if (isEntraProvider(providerId) && !isMicrosoftIssuerHost(issuer)) {
    return [];
  }

  if (isMicrosoftIssuerHost(issuer)) {
    const tenant = (tenantId || "common").trim();
    return [
      `https://login.microsoftonline.com/${tenant}/discovery/v2.0/keys`,
      `https://login.microsoftonline.com/${tenant}/discovery/keys`,
    ];
  }

  const metadataUrl = buildMetadataUrl(issuer);
  if (!metadataUrl || metadataUrl.includes("->")) return [];

  try {
    const response = await fetch(metadataUrl, { cache: "no-store" });
    const json = await response.json();
    if (json && typeof json === "object" && "jwks_uri" in json) {
      return [String(json.jwks_uri)];
    }
  } catch {}

  return [];
}

async function verifyTokenSignatureStatus({
  token,
  header,
  payload,
  providerId,
}: {
  token?: string;
  header: JwtHeader;
  payload: JwtPayload;
  providerId?: IdentityProviderId;
}): Promise<SigStatus> {
  const status: SigStatus = {
    kid: header.kid,
    alg: header.alg,
    ver: payload.ver,
    iss: payload.iss,
    metadataUrl: buildMetadataUrl(payload.iss),
    jwksUrl: undefined,
    jwksFetched: false,
    keyFound: false,
    verified: false,
  };

  if (!token || !payload.iss) return status;

  try {
    const candidates = await resolveJwksCandidates(
      payload.iss,
      payload.tid,
      providerId,
    );
    if (candidates.length === 0) {
      status.reason = "No JWKS URI could be resolved";
      status.jwksUrl = guessJwksUrl(payload.iss, payload.tid, payload.ver);
      return status;
    }

    for (const jwksUrl of candidates) {
      const result = await verifyJwtSignature(token, jwksUrl, header.kid);
      status.jwksUrl = jwksUrl;
      status.jwksFetched = true;
      status.keyFound = result.keyFound;
      status.verified = !!result.ok;
      if (result.error) status.error = result.error;
      if (result.reason) status.reason = result.reason;
      if (result.publicKeyPem) status.publicKeyPem = result.publicKeyPem;
      if (result.ok) break;
    }
  } catch (error) {
    status.error = String(error);
  }

  return status;
}

export default function StepValidate(props: Readonly<Props>) {
  const t = useTranslations("StepValidate");
  const {
    providerId = DEFAULT_PROVIDER_ID,
    tenantId,
    issuerUrl = "",
    clientId,
    expectedAudience = "",
    expectedNonce,
    isClientCredentials,
    decodedAccessHeader,
    decodedAccessPayload,
    decodedIdHeader,
    decodedIdPayload,
    decodedAccessFormat,
    decodedIdFormat,
    accessToken,
    idToken,
    dpopEnabled,
    dpopJkt,
    tokenResponseText,
    tokenType,
  } = props;

  const accessHeader = useMemo(
    () => parseJson<JwtHeader>(decodedAccessHeader) || {},
    [decodedAccessHeader],
  );
  const accessPayload = useMemo(
    () => parseJson<JwtPayload>(decodedAccessPayload) || {},
    [decodedAccessPayload],
  );
  const idHeader = useMemo(
    () => parseJson<JwtHeader>(decodedIdHeader) || {},
    [decodedIdHeader],
  );
  const idPayload = useMemo(
    () => parseJson<JwtPayload>(decodedIdPayload) || {},
    [decodedIdPayload],
  );

  const accIss = accessPayload.iss;
  const idIss = idPayload.iss;
  const accMeta = buildMetadataUrl(accIss);
  const idMeta = buildMetadataUrl(idIss);
  const accJwks = guessJwksUrl(accIss, accessPayload.tid, accessPayload.ver);
  const idJwks = guessJwksUrl(idIss, idPayload.tid, idPayload.ver);
  const expectedIssuer = getIssuerForValidation({
    providerId,
    tenantId,
    issuerUrl,
  });
  const issuerExpectationLabel = getIssuerExpectationLabel(
    expectedIssuer,
    providerId,
  );
  // Several rows below describe claims only Entra issues — a token version, `scp`,
  // `roles`, `wids`. Showing them for Auth0 describes its tokens with the wrong
  // model, so each is gated on the workspace rather than rendered unconditionally.
  const isEntraWorkspace = providerId === "entra";
  // For rows that report something rather than check it. A green tick here reads
  // as "this passed" when nothing was validated at all.
  const informational = (
    <span className="ml-2" style={{ color: "var(--yellow-500)" }}>
      <span
        className="pi pi-info-circle"
        aria-label={t("validateUi.informationalAria")}
      />
    </span>
  );

  const [idSig, setIdSig] = useState<SigStatus>({});
  const [accSig, setAccSig] = useState<SigStatus>({});
  const [nowSec, setNowSec] = useState(0);

  // What verifyJwtSignature will actually accept. Matching on a "RS" prefix let a
  // JWE's key-management `alg` — RSA-OAEP-256, RSA1_5 — tick green as though it
  // were a signature algorithm.
  const isAcceptedSignatureAlg = (alg?: string) =>
    !!alg && ["RS256", "RS384", "RS512"].includes(alg);

  const graphAud = "00000003-0000-0000-c000-000000000000";
  const graphAudUrl = "https://graph.microsoft.com";
  const accessAudiences = useMemo(
    () => ensureArray(accessPayload.aud),
    [accessPayload.aud],
  );
  const isGraphAccessToken = accessAudiences.some((aud) => {
    const normalized = String(aud || "")
      .trim()
      .replace(/\/$/, "");
    return normalized === graphAud || normalized === graphAudUrl;
  });
  // The ID token needs the same guard as the access token below. Without it an
  // encrypted ID token falls through to the signature block, which reads its JWE
  // key-management `alg` as if it were a signature algorithm.
  const idTokenEncrypted =
    decodedIdFormat === "jwe" || typeof idHeader.enc === "string";
  const accessTokenEncrypted =
    decodedAccessFormat === "jwe" || typeof accessHeader.enc === "string";
  // Auth0 issues an opaque access token when the request names no API audience.
  // There is no header, no payload and no signature — nothing to validate, and
  // nothing wrong either.
  const accessTokenOpaque = decodedAccessFormat === "opaque";
  // Both cases reach the same place: the step reports why it is not validating
  // rather than reporting a failure.
  const accessTokenUnreadable = accessTokenEncrypted || accessTokenOpaque;

  useEffect(() => {
    let active = true;

    // Nothing to verify: a JWE carries no signature this client can check.
    if (idTokenEncrypted) {
      return () => {
        active = false;
      };
    }

    verifyTokenSignatureStatus({
      token: idToken,
      header: idHeader,
      payload: idPayload,
      providerId,
    }).then((status) => {
      if (active) setIdSig(status);
    });

    return () => {
      active = false;
    };
  }, [idHeader, idPayload, idToken, idTokenEncrypted, providerId]);

  useEffect(() => {
    let active = true;

    if (isGraphAccessToken || accessTokenUnreadable) {
      return () => {
        active = false;
      };
    }

    verifyTokenSignatureStatus({
      token: accessToken,
      header: accessHeader,
      payload: accessPayload,
      providerId,
    }).then((status) => {
      if (active) setAccSig(status);
    });

    return () => {
      active = false;
    };
  }, [
    accessHeader,
    accessPayload,
    accessToken,
    accessTokenUnreadable,
    isGraphAccessToken,
    providerId,
  ]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setNowSec(Math.floor(Date.now() / 1000));
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  const skewSec = 300;

  const idClaimOk = useMemo(() => {
    const audiences = ensureArray(idPayload.aud);
    return {
      audOk: clientId ? audiences.includes(clientId) : audiences.length > 0,
      issOk: issuerMatchesExpected(idIss, expectedIssuer, providerId),
      nonceOk: expectedNonce ? idPayload.nonce === expectedNonce : true,
      expOk:
        typeof idPayload.exp === "number"
          ? idPayload.exp > nowSec - skewSec
          : false,
      nbfOk:
        typeof idPayload.nbf === "number"
          ? idPayload.nbf <= nowSec + skewSec
          : true,
      iatOk:
        typeof idPayload.iat === "number"
          ? idPayload.iat <= nowSec + skewSec
          : true,
    };
  }, [
    clientId,
    expectedIssuer,
    expectedNonce,
    idIss,
    idPayload,
    nowSec,
    providerId,
    skewSec,
  ]);

  const isDPoPActive = !!dpopEnabled && !isEntraWorkspace;

  const resolvedTokenType = useMemo(() => {
    if (tokenType) return tokenType;
    if (!tokenResponseText) return undefined;
    try {
      const parsed = JSON.parse(tokenResponseText);
      return typeof parsed?.token_type === "string"
        ? parsed.token_type
        : undefined;
    } catch {
      return undefined;
    }
  }, [tokenType, tokenResponseText]);

  const accClaimOk = useMemo(
    () => ({
      audOk: expectedAudience
        ? accessAudiences.includes(expectedAudience)
        : accessAudiences.length > 0,
      issOk: issuerMatchesExpected(accIss, expectedIssuer, providerId),
      scopesOk: true,
      expOk:
        typeof accessPayload.exp === "number"
          ? accessPayload.exp > nowSec - skewSec
          : false,
      nbfOk:
        typeof accessPayload.nbf === "number"
          ? accessPayload.nbf <= nowSec + skewSec
          : true,
      iatOk:
        typeof accessPayload.iat === "number"
          ? accessPayload.iat <= nowSec + skewSec
          : true,
      tokenTypeOk: resolvedTokenType
        ? resolvedTokenType.toLowerCase() === "dpop"
        : false,
      cnfOk:
        typeof accessPayload.cnf?.jkt === "string" &&
        !!dpopJkt &&
        accessPayload.cnf.jkt === dpopJkt,
    }),
    [
      accIss,
      accessAudiences,
      accessPayload,
      expectedIssuer,
      expectedAudience,
      nowSec,
      providerId,
      skewSec,
      resolvedTokenType,
      dpopJkt,
    ],
  );

  return (
    <section>
      <h3 className="mt-0 mb-3">{t("sections.validate.title")}</h3>
      <p className="mb-3">{t("sections.validate.description")}</p>
      {isGraphAccessToken && (
        <div className="mt-2 flex gap-3 align-items-start pl-2">
          <i
            className="pi pi-exclamation-circle mr-2"
            style={{
              color: "var(--yellow-500)",
              fontSize: "1.1rem",
              marginTop: "0.2rem",
            }}
            aria-hidden="true"
          />
          <p className="m-0 text-sm">
            {(t as any).rich("validateUi.graphWarning", {
              code: renderCode,
              aud: graphAud,
            })}
          </p>
        </div>
      )}

      {!!idToken && (
        <div className="mb-5">
          <h4 className="mt-3">{t("validateUi.idTokenTitle")}</h4>
          <h5 className="mt-2">
            {t("validateUi.signatureValidation")}{" "}
            {idTokenEncrypted ? (
              <span className="ml-2" style={{ color: "var(--yellow-500)" }}>
                <span
                  className="pi pi-forward mr-2"
                  aria-label={t("validateUi.skippedAria")}
                />
                {t("validateUi.skipped")}
              </span>
            ) : (
              typeof idSig.verified === "boolean" && (
                <span className="ml-2">
                  <StatusIcon
                    ok={!!idSig.verified}
                    label={
                      idSig.verified
                        ? t("validateUi.verified")
                        : t("validateUi.notVerified")
                    }
                  />
                </span>
              )
            )}
          </h5>
          {idTokenEncrypted && (
            <p className="mt-2 text-sm opacity-75">
              {t("validateUi.encryptedIdToken")}
            </p>
          )}
          {!idTokenEncrypted && (
            <ol>
              <li>
                {t("validateUi.steps.extractKid")}{" "}
                <code>{idHeader.kid || "—"}</code>{" "}
                <span className="ml-2">
                  <StatusIcon ok={!!idHeader.kid} />
                </span>
              </li>
              <li>
                {t("validateUi.steps.extractAlg")}{" "}
                <code>{idHeader.alg || "—"}</code>{" "}
                <span className="ml-2">
                  <StatusIcon ok={isAcceptedSignatureAlg(idHeader.alg)} />
                </span>
              </li>
              {isEntraWorkspace && (
                <li>
                  {t("validateUi.steps.extractVersion")}{" "}
                  <code>
                    {idPayload.ver ||
                      (idIss?.includes("/v2.0") ? "2.0 (from iss)" : "1.0?")}
                  </code>{" "}
                  {informational}
                </li>
              )}
              <li>
                {t("validateUi.steps.extractIssuer")}{" "}
                <code>{idIss || "—"}</code>{" "}
                <span className="ml-2">
                  <StatusIcon ok={!!idIss} />
                </span>
              </li>
              <li>
                {t("validateUi.steps.buildMetadata")}{" "}
                <code>{idMeta || "—"}</code>{" "}
                <span className="ml-2">
                  <StatusIcon ok={!!idMeta} />
                </span>
              </li>
              <li>
                {t("validateUi.steps.resolveJwks")}{" "}
                <code>{idSig.jwksUrl || idJwks || "—"}</code>{" "}
                <span className="ml-2">
                  <StatusIcon ok={!!(idSig.jwksUrl || idJwks)} />
                </span>
              </li>
              <li>
                {t("validateUi.steps.fetchJwksFindKey")}{" "}
                <code>{idHeader.kid || "—"}</code>{" "}
                <span className="ml-2">
                  <StatusIcon ok={idSig.keyFound} />
                </span>
              </li>
              <li>
                {t("validateUi.steps.verifySignature")}{" "}
                <code>{idHeader.alg || "—"}</code>{" "}
                <span className="ml-2">
                  <StatusIcon ok={idSig.verified} />
                </span>
              </li>
            </ol>
          )}
          {idSig.reason && (
            <p
              className="mt-2"
              style={{ color: idSig.verified ? "#16a34a" : "#dc2626" }}
            >
              {t("validateUi.reason")} {idSig.reason}
            </p>
          )}
          {idSig.error && (
            <p style={{ color: "#dc2626" }}>
              {t("validateUi.error")} {idSig.error}
            </p>
          )}
          {idSig.publicKeyPem && (
            <details className="mt-2">
              <summary>{t("validateUi.publicKeyPem")}</summary>
              <pre style={{ whiteSpace: "pre-wrap" }}>{idSig.publicKeyPem}</pre>
            </details>
          )}
          <h5 className="mt-3">{t("validateUi.claimValidations")}</h5>
          {idTokenEncrypted ? (
            <p className="mt-2 text-sm opacity-75">
              {t("validateUi.encryptedClaimValidation")}
            </p>
          ) : (
            <ul>
              <li>
                {t("validateUi.claims.id.aud")}{" "}
                <code>{String(idPayload.aud)}</code>{" "}
                {clientId ? `(expected ${clientId})` : ""}
                <span className="ml-2">
                  <StatusIcon ok={idClaimOk.audOk} />
                </span>
              </li>
              <li>
                {t("validateUi.claims.id.iss")}{" "}
                <code>{idPayload.iss || "—"}</code> {issuerExpectationLabel}
                <span className="ml-2">
                  <StatusIcon ok={idClaimOk.issOk} />
                </span>
              </li>
              <li>
                {t("validateUi.claims.id.exp")}{" "}
                <code>{fmtEpoch(idPayload.exp)}</code>
                <span className="ml-2">
                  <StatusIcon ok={idClaimOk.expOk} />
                </span>
              </li>
              <li>
                {t("validateUi.claims.id.nbfIat")}: nbf{" "}
                <code>{fmtEpoch(idPayload.nbf)}</code>, iat{" "}
                <code>{fmtEpoch(idPayload.iat)}</code>
                <span className="ml-2">
                  <StatusIcon ok={idClaimOk.nbfOk && idClaimOk.iatOk} />
                </span>
              </li>
              <li>
                {t("validateUi.claims.id.nonce")}{" "}
                <code>{idPayload.nonce || "—"}</code>{" "}
                {expectedNonce ? `(expected ${expectedNonce})` : ""}
                <span className="ml-2">
                  <StatusIcon ok={idClaimOk.nonceOk} />
                </span>
              </li>
            </ul>
          )}
          {/* Diagnostics UI removed */}
        </div>
      )}

      <div>
        <h4 className="mt-3">{t("validateUi.accessTokenTitle")}</h4>
        <h5 className="mt-2">
          {t("validateUi.signatureValidation")}{" "}
          {isGraphAccessToken || accessTokenUnreadable ? (
            <span className="ml-2" style={{ color: "var(--yellow-500)" }}>
              <span
                className="pi pi-forward mr-2"
                aria-label={t("validateUi.skippedAria")}
              />
              {t("validateUi.skipped")}
            </span>
          ) : (
            typeof accSig.verified === "boolean" && (
              <span className="ml-2">
                <StatusIcon
                  ok={!!accSig.verified}
                  label={
                    accSig.verified
                      ? t("validateUi.verified")
                      : t("validateUi.notVerified")
                  }
                />
              </span>
            )
          )}
        </h5>
        {accessTokenEncrypted && (
          <p className="mt-2 text-sm opacity-75">
            {t("validateUi.encryptedAccessToken")}
          </p>
        )}
        {accessTokenOpaque && (
          <p className="mt-2 text-sm opacity-75">
            {t("validateUi.opaqueAccessToken")}
          </p>
        )}
        {!isGraphAccessToken && !accessTokenUnreadable && (
          <ol>
            <li>
              {t("validateUi.steps.extractKid")}{" "}
              <code>{accessHeader.kid || "—"}</code>{" "}
              <span className="ml-2">
                <StatusIcon ok={!!accessHeader.kid} />
              </span>
            </li>
            <li>
              {t("validateUi.steps.extractAlg")}{" "}
              <code>{accessHeader.alg || "—"}</code>{" "}
              <span className="ml-2">
                <StatusIcon ok={isAcceptedSignatureAlg(accessHeader.alg)} />
              </span>
            </li>
            {isEntraWorkspace && (
              <li>
                {t("validateUi.steps.extractVersion")}{" "}
                <code>{accessPayload.ver || "—"}</code>
                {informational}
              </li>
            )}
            <li>
              {t("validateUi.steps.extractIssuer")} <code>{accIss || "—"}</code>{" "}
              <span className="ml-2">
                <StatusIcon ok={!!accIss} />
              </span>
            </li>
            <li>
              {t("validateUi.steps.buildMetadata")}{" "}
              <code>{accMeta || "—"}</code>{" "}
              <span className="ml-2">
                <StatusIcon ok={!!accMeta} />
              </span>
            </li>
            <li>
              {t("validateUi.steps.resolveJwks")}{" "}
              <code>{accSig.jwksUrl || accJwks || "—"}</code>{" "}
              <span className="ml-2">
                <StatusIcon ok={!!(accSig.jwksUrl || accJwks)} />
              </span>
            </li>
            <li>
              {t("validateUi.steps.fetchJwksFindKey")}{" "}
              <code>{accessHeader.kid || "—"}</code>{" "}
              <span className="ml-2">
                <StatusIcon ok={accSig.keyFound} />
              </span>
            </li>
            <li>
              {t("validateUi.steps.verifySignature")}{" "}
              <code>{accessHeader.alg || "—"}</code>{" "}
              <span className="ml-2">
                <StatusIcon ok={accSig.verified} />
              </span>
            </li>
          </ol>
        )}
        {!isGraphAccessToken && !accessTokenUnreadable && accSig.reason && (
          <p
            className="mt-2"
            style={{ color: accSig.verified ? "#16a34a" : "#dc2626" }}
          >
            {t("validateUi.reason")} {accSig.reason}
          </p>
        )}
        {!isGraphAccessToken && !accessTokenUnreadable && accSig.error && (
          <p style={{ color: "#dc2626" }}>
            {t("validateUi.error")} {accSig.error}
          </p>
        )}
        {!isGraphAccessToken &&
          !accessTokenUnreadable &&
          accSig.publicKeyPem && (
            <details className="mt-2">
              <summary>{t("validateUi.publicKeyPem")}</summary>
              <pre style={{ whiteSpace: "pre-wrap" }}>
                {accSig.publicKeyPem}
              </pre>
            </details>
          )}
        <h5 className="mt-3">{t("validateUi.claimValidations")}</h5>
        {accessTokenUnreadable ? (
          <p className="mt-2 text-sm opacity-75">
            {accessTokenOpaque
              ? t("validateUi.opaqueClaimValidation")
              : t("validateUi.encryptedClaimValidation")}
          </p>
        ) : (
          <ul>
            <li>
              {t("validateUi.claims.access.ver")}{" "}
              <code>{accessPayload.ver || "—"}</code>
              <span className="ml-2" style={{ color: "var(--yellow-500)" }}>
                <span
                  className="pi pi-forward mr-2"
                  aria-label={t("validateUi.skippedAria")}
                />
                {t("validateUi.skipped")}
              </span>
            </li>
            <li>
              {t("validateUi.claims.access.aud")}{" "}
              <code>{String(accessPayload.aud)}</code>{" "}
              {isGraphAccessToken ? t("validateUi.claims.access.msGraph") : ""}
              <span className="ml-2">
                <StatusIcon ok={accClaimOk.audOk} />
              </span>
            </li>
            <li>
              {t("validateUi.claims.access.iss")}{" "}
              <code>{accessPayload.iss || "—"}</code> {issuerExpectationLabel}
              <span className="ml-2">
                <StatusIcon ok={accClaimOk.issOk} />
              </span>
            </li>
            <li>
              {t("validateUi.claims.access.exp")}{" "}
              <code>{fmtEpoch(accessPayload.exp)}</code>
              <span className="ml-2">
                <StatusIcon ok={accClaimOk.expOk} />
              </span>
            </li>
            <li>
              {t("validateUi.claims.access.nbfIat")}: nbf{" "}
              <code>{fmtEpoch(accessPayload.nbf)}</code>, iat{" "}
              <code>{fmtEpoch(accessPayload.iat)}</code>
              <span className="ml-2">
                <StatusIcon ok={accClaimOk.nbfOk && accClaimOk.iatOk} />
              </span>
            </li>
            {isDPoPActive && (
              <>
                {resolvedTokenType && (
                  <li>
                    {t("validateUi.claims.access.tokenType")}:{" "}
                    <code>{resolvedTokenType}</code>{" "}
                    <span className="ml-2">
                      <StatusIcon ok={accClaimOk.tokenTypeOk} />
                    </span>
                  </li>
                )}
                <li>
                  {t("validateUi.claims.access.cnf")}:{" "}
                  <code>{accessPayload.cnf?.jkt || "—"}</code>{" "}
                  {dpopJkt ? `(expected ${dpopJkt})` : ""}
                  <span className="ml-2">
                    <StatusIcon ok={accClaimOk.cnfOk} />
                  </span>
                </li>
              </>
            )}
            {/* Entra splits delegated (`scp`) from application (`roles`) grants, so
                its client-credentials tokens have no scope row. Auth0 grants a
                machine-to-machine client scopes like any other, so it keeps one. */}
            {(!isClientCredentials || !isEntraWorkspace) && (
              <li>
                {isEntraWorkspace
                  ? t("validateUi.claims.access.scp")
                  : t("validateUi.claims.access.scope")}{" "}
                <code>
                  {(isEntraWorkspace
                    ? accessPayload.scp
                    : accessPayload.scope) || "—"}
                </code>
                <span className="ml-2" style={{ color: "var(--yellow-500)" }}>
                  <span
                    className="pi pi-forward mr-2"
                    aria-label={t("validateUi.skippedAria")}
                  />
                  {t("validateUi.skipped")}
                </span>
              </li>
            )}
            {/* `roles` and `wids` are Entra's application-permission model. Auth0
                grants a machine-to-machine client scopes, which the row above
                already shows, so there is nothing to list here. */}
            {isClientCredentials && isEntraWorkspace && (
              <>
                <li>
                  {t("validateUi.claims.access.roles")}{" "}
                  <code>
                    {Array.isArray(accessPayload.roles)
                      ? accessPayload.roles.join(" ")
                      : accessPayload.roles || "—"}
                  </code>
                  <span className="ml-2" style={{ color: "var(--yellow-500)" }}>
                    <span
                      className="pi pi-forward mr-2"
                      aria-label={t("validateUi.skippedAria")}
                    />
                    {t("validateUi.skipped")}
                  </span>
                </li>
                <li>
                  {t("validateUi.claims.access.wids")}{" "}
                  <code>
                    {Array.isArray(accessPayload.wids)
                      ? accessPayload.wids.join(" ")
                      : accessPayload.wids || "—"}
                  </code>
                  <span className="ml-2" style={{ color: "var(--yellow-500)" }}>
                    <span
                      className="pi pi-forward mr-2"
                      aria-label={t("validateUi.skippedAria")}
                    />
                    {t("validateUi.skipped")}
                  </span>
                </li>
              </>
            )}
          </ul>
        )}
      </div>
    </section>
  );
}
