"use client";
import { InputTextarea } from "primereact/inputtextarea";
import { Button } from "primereact/button";
import { useTranslations } from "next-intl";
import { Dialog } from "primereact/dialog";
import { type ReactNode, useMemo, useState } from "react";
import LabelWithHelp from "@/components/LabelWithHelp";
import {
  ACCESS_CLAIMS_DOC,
  AUTH0_TOKENS_DOC,
  IANA_JWT_CLAIMS_DOC,
  ID_CLAIMS_DOC,
  JWT_REGISTERED_CLAIMS_DOC,
  OPTIONAL_CLAIMS_DOC,
  parsePayloadToClaims,
  resolveClaimDescriptions,
  type ClaimDescriptionGroups,
} from "@/lib/jwtClaims";
import type { DecodedTokenFormat } from "@/lib/jwtDecode";
import type { IdentityProviderId } from "@/lib/identityProvider";

type Props = {
  accessToken: string;
  idToken: string;
  decodedAccessHeader: string;
  decodedAccessPayload: string;
  decodedAccessFormat: DecodedTokenFormat;
  decodedIdHeader: string;
  decodedIdPayload: string;
  decodedIdFormat: DecodedTokenFormat;
  providerId?: IdentityProviderId;
  onDecodeTokens: () => void;
};

const renderCodeChunk = (chunks: ReactNode) => <code>{chunks}</code>;

type TokenType = "access" | "id";

export default function StepDecode({
  accessToken,
  idToken,
  decodedAccessHeader,
  decodedAccessPayload,
  decodedAccessFormat,
  decodedIdHeader,
  decodedIdPayload,
  decodedIdFormat,
  providerId = "entra",
  onDecodeTokens,
}: Readonly<Props>) {
  const t = useTranslations("StepDecode");
  const [activeDialogToken, setActiveDialogToken] = useState<TokenType | null>(
    null,
  );
  const claimDescriptions = useMemo(
    () =>
      resolveClaimDescriptions(
        (t.raw("claimDescriptions") as ClaimDescriptionGroups) ?? {},
        providerId,
      ),
    [t, providerId],
  );
  const unknownClaimDescription = t("claimsDialog.unknownClaimDescription");
  const namespacedClaimDescription = t(
    "claimsDialog.namespacedClaimDescription",
  );
  const accessPayloadValue = useMemo(() => {
    if (decodedAccessFormat === "jwe") {
      return t("notes.encryptedPayloadPlaceholder");
    }
    if (decodedAccessFormat === "opaque") {
      return t("notes.opaquePayloadPlaceholder");
    }
    return decodedAccessPayload;
  }, [decodedAccessFormat, decodedAccessPayload, t]);
  const idPayloadValue = useMemo(
    () =>
      decodedIdFormat === "jwe"
        ? t("notes.encryptedPayloadPlaceholder")
        : decodedIdPayload,
    [decodedIdFormat, decodedIdPayload, t],
  );
  // Compute rows from content lines so areas grow to show all content
  const calcRows = (value: string, minRows: number) => {
    try {
      const lines = (value ?? "").split("\n").length;
      return Math.max(minRows, lines + 1 || 1);
    } catch {
      return minRows;
    }
  };
  const rowsAccessHeader = useMemo(
    () => calcRows(decodedAccessHeader, 6),
    [decodedAccessHeader],
  );
  const rowsIdHeader = useMemo(
    () => calcRows(decodedIdHeader, 6),
    [decodedIdHeader],
  );
  const rowsAccessPayload = useMemo(
    () => calcRows(accessPayloadValue, 10),
    [accessPayloadValue],
  );
  const rowsIdPayload = useMemo(
    () => calcRows(idPayloadValue, 10),
    [idPayloadValue],
  );
  const accessClaims = useMemo(
    () =>
      parsePayloadToClaims(
        decodedAccessPayload,
        claimDescriptions,
        unknownClaimDescription,
        namespacedClaimDescription,
      ),
    [
      decodedAccessPayload,
      claimDescriptions,
      unknownClaimDescription,
      namespacedClaimDescription,
    ],
  );
  const idClaims = useMemo(
    () =>
      parsePayloadToClaims(
        decodedIdPayload,
        claimDescriptions,
        unknownClaimDescription,
        namespacedClaimDescription,
      ),
    [
      decodedIdPayload,
      claimDescriptions,
      unknownClaimDescription,
      namespacedClaimDescription,
    ],
  );
  const hasAccessHeaderNonce = useMemo(() => {
    try {
      const obj = JSON.parse(decodedAccessHeader || "{}");
      return obj && typeof obj === "object" && "nonce" in obj;
    } catch {
      return (decodedAccessHeader || "").includes('"nonce"');
    }
  }, [decodedAccessHeader]);
  const activeClaims = activeDialogToken === "access" ? accessClaims : idClaims;
  const activeDialogTitle =
    activeDialogToken === "access"
      ? t("claimsDialog.accessTitle")
      : t("claimsDialog.idTitle");
  const primaryDocUrl =
    providerId === "auth0"
      ? AUTH0_TOKENS_DOC
      : activeDialogToken === "access"
        ? ACCESS_CLAIMS_DOC
        : ID_CLAIMS_DOC;
  const primaryDocLabel =
    providerId === "auth0"
      ? t("claimsDialog.references.auth0")
      : activeDialogToken === "access"
        ? t("claimsDialog.references.access")
        : t("claimsDialog.references.id");
  const supplementalDocs =
    providerId === "auth0"
      ? [
          {
            href: JWT_REGISTERED_CLAIMS_DOC,
            label: t("claimsDialog.references.registered"),
          },
          {
            href: IANA_JWT_CLAIMS_DOC,
            label: t("claimsDialog.references.iana"),
          },
        ]
      : [
          {
            href: OPTIONAL_CLAIMS_DOC,
            label: t("claimsDialog.references.optional"),
          },
        ];

  return (
    <section>
      <p className="mb-3">{t("sections.decode.description")}</p>
      <div className="mb-4 surface-0 py-3 px-0 border-round">
        <div className="grid formgrid p-fluid gap-3">
          <div className="col-12">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(12rem, 14rem) 1fr",
                alignItems: "start",
                columnGap: "0.75rem",
                width: "100%",
              }}
            >
              <div style={{ textAlign: "left" }}>
                <LabelWithHelp
                  id="accessToken"
                  text={t("labels.accessToken")}
                  help={t("help.accessToken")}
                />
              </div>
              <div>
                <InputTextarea
                  id="accessToken"
                  rows={3}
                  autoResize
                  value={accessToken}
                  readOnly
                  wrap="soft"
                  style={{
                    width: "100%",
                    whiteSpace: "pre-wrap",
                    resize: "vertical",
                  }}
                />
              </div>
            </div>
          </div>
          <div className="col-12">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(12rem, 14rem) 1fr",
                alignItems: "start",
                columnGap: "0.75rem",
                width: "100%",
              }}
            >
              <div style={{ textAlign: "left" }}>
                <LabelWithHelp
                  id="idToken"
                  text={t("labels.idToken")}
                  help={t("help.idToken")}
                />
              </div>
              <div>
                <InputTextarea
                  id="idToken"
                  rows={3}
                  autoResize
                  value={idToken}
                  readOnly
                  wrap="soft"
                  style={{
                    width: "100%",
                    whiteSpace: "pre-wrap",
                    resize: "vertical",
                  }}
                />
              </div>
            </div>
          </div>
          <div className="col-12 flex gap-2 mt-3 mb-3">
            <Button
              type="button"
              label={t("buttons.decode")}
              icon="pi pi-code"
              onClick={onDecodeTokens}
              disabled={!accessToken && !idToken}
            />
          </div>
          {/* Two columns: row 1 = both headers, row 2 = both payloads (keeps payloads aligned) */}
          <div className="col-12">
            <div
              className="w-full"
              style={{
                display: "grid",
                gap: "1rem",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                alignItems: "start",
              }}
            >
              {/* Row 1: headers — keep order consistent with tokens (Access, then ID) */}
              <div>
                <LabelWithHelp
                  id="accessHeader"
                  text={t("labels.accessHeader")}
                  help={t("help.accessHeader")}
                />
                <InputTextarea
                  id="accessHeader"
                  rows={rowsAccessHeader}
                  autoResize
                  value={decodedAccessHeader}
                  style={{
                    width: "100%",
                    whiteSpace: "pre-wrap",
                    resize: "vertical",
                  }}
                />
                {/* Hint: Some providers include a JOSE 'nonce' header in access tokens; not used for OIDC nonce validation */}
                {hasAccessHeaderNonce && (
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
                      {(t as any).rich("notes.accessHeaderNonce", {
                        code: renderCodeChunk,
                      })}
                    </p>
                  </div>
                )}
              </div>
              <div>
                <LabelWithHelp
                  id="idHeader"
                  text={t("labels.idHeader")}
                  help={t("help.idHeader")}
                />
                <InputTextarea
                  id="idHeader"
                  rows={rowsIdHeader}
                  autoResize
                  value={decodedIdHeader}
                  style={{
                    width: "100%",
                    whiteSpace: "pre-wrap",
                    resize: "vertical",
                  }}
                />
              </div>
              {/* Row 2: payloads (aligned with headers) */}
              <div>
                <div className="flex align-items-center gap-2 mb-2">
                  <LabelWithHelp
                    id="accessPayload"
                    text={t("labels.accessPayload")}
                    help={t("help.accessPayload")}
                  />
                  <button
                    type="button"
                    className="p-link"
                    aria-label={t("claimsDialog.openAccess")}
                    title={t("claimsDialog.openAccess")}
                    onClick={() => setActiveDialogToken("access")}
                    disabled={!accessClaims.length}
                    style={{
                      border: "none",
                      background: "transparent",
                      cursor: accessClaims.length ? "pointer" : "not-allowed",
                      opacity: accessClaims.length ? 1 : 0.45,
                      color: "#0ea5e9",
                    }}
                  >
                    <i
                      className="pi pi-file"
                      style={{ fontSize: "1rem" }}
                      aria-hidden="true"
                    />
                  </button>
                </div>
                <InputTextarea
                  id="accessPayload"
                  rows={rowsAccessPayload}
                  autoResize
                  value={accessPayloadValue}
                  style={{
                    width: "100%",
                    whiteSpace: "pre-wrap",
                    resize: "vertical",
                  }}
                />
                {decodedAccessFormat === "jwe" && (
                  <div className="mt-2 flex gap-3 align-items-start pl-2">
                    <i
                      className="pi pi-lock mr-2"
                      style={{
                        color: "var(--primary-color)",
                        fontSize: "1.1rem",
                        marginTop: "0.2rem",
                      }}
                      aria-hidden="true"
                    />
                    <p className="m-0 text-sm">{t("notes.encryptedToken")}</p>
                  </div>
                )}
                {decodedAccessFormat === "opaque" && (
                  <div className="mt-2 flex gap-3 align-items-start pl-2">
                    <i
                      className="pi pi-info-circle mr-2"
                      style={{
                        color: "var(--primary-color)",
                        fontSize: "1.1rem",
                        marginTop: "0.2rem",
                      }}
                      aria-hidden="true"
                    />
                    <p className="m-0 text-sm">{t("notes.opaqueToken")}</p>
                  </div>
                )}
              </div>
              <div>
                <div className="flex align-items-center gap-2 mb-2">
                  <LabelWithHelp
                    id="idPayload"
                    text={t("labels.idPayload")}
                    help={t("help.idPayload")}
                  />
                  <button
                    type="button"
                    className="p-link"
                    aria-label={t("claimsDialog.openId")}
                    title={t("claimsDialog.openId")}
                    onClick={() => setActiveDialogToken("id")}
                    disabled={!idClaims.length}
                    style={{
                      border: "none",
                      background: "transparent",
                      cursor: idClaims.length ? "pointer" : "not-allowed",
                      opacity: idClaims.length ? 1 : 0.45,
                      color: "#0ea5e9",
                    }}
                  >
                    <i
                      className="pi pi-file"
                      style={{ fontSize: "1rem" }}
                      aria-hidden="true"
                    />
                  </button>
                </div>
                <InputTextarea
                  id="idPayload"
                  rows={rowsIdPayload}
                  autoResize
                  value={idPayloadValue}
                  style={{
                    width: "100%",
                    whiteSpace: "pre-wrap",
                    resize: "vertical",
                  }}
                />
                {decodedIdFormat === "jwe" && (
                  <div className="mt-2 flex gap-3 align-items-start pl-2">
                    <i
                      className="pi pi-lock mr-2"
                      style={{
                        color: "var(--primary-color)",
                        fontSize: "1.1rem",
                        marginTop: "0.2rem",
                      }}
                      aria-hidden="true"
                    />
                    <p className="m-0 text-sm">{t("notes.encryptedToken")}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog
        visible={!!activeDialogToken}
        header={activeDialogTitle}
        style={{ width: "min(62rem, 95vw)" }}
        onHide={() => setActiveDialogToken(null)}
      >
        {activeClaims.length === 0 ? (
          <p className="m-0">{t("claimsDialog.noClaims")}</p>
        ) : (
          <div className="overflow-auto">
            <table className="w-full" style={{ tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "18%" }} />
                <col style={{ width: "32%" }} />
                <col style={{ width: "50%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="text-left p-2">
                    {t("claimsDialog.columns.name")}
                  </th>
                  <th className="text-left p-2">
                    {t("claimsDialog.columns.value")}
                  </th>
                  <th className="text-left p-2">
                    {t("claimsDialog.columns.description")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {activeClaims.map((claim) => (
                  <tr
                    key={claim.name}
                    className="surface-border border-bottom-1"
                  >
                    <td
                      className="p-2"
                      style={{ verticalAlign: "top", wordBreak: "break-word" }}
                    >
                      {claim.name}
                    </td>
                    <td
                      className="p-2"
                      style={{
                        verticalAlign: "top",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    >
                      {claim.value}
                    </td>
                    <td
                      className="p-2"
                      style={{ verticalAlign: "top", wordBreak: "break-word" }}
                    >
                      {claim.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-3">
              <p className="m-0 mb-2 font-semibold">
                {t("claimsDialog.references.title")}
              </p>
              <ul className="m-0 pl-3">
                <li>
                  <a
                    href={primaryDocUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {primaryDocLabel}
                  </a>
                </li>
                {supplementalDocs.map((reference) => (
                  <li key={reference.href}>
                    <a
                      href={reference.href}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {reference.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Dialog>
    </section>
  );
}
